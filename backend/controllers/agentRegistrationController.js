const bcrypt  = require('bcryptjs');
const PDFDoc  = require('pdfkit');
const db      = require('../config/database');
const { uploadFile } = require('../utils/storageService');

// ── GET /api/agent-auth/validate-token/:token ─────────────────
async function validateToken(req, res) {
  const { token } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT id, note, expires_at, used_at
         FROM agent_registration_tokens
        WHERE token = $1`,
      [token]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Invalid registration link' });
    const t = rows[0];
    if (t.used_at) return res.status(410).json({ error: 'This registration link has already been used' });
    if (new Date(t.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This registration link has expired. Please contact your admin.' });
    }
    res.json({ valid: true, note: t.note });
  } catch (err) {
    console.error('validateToken error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/agent-auth/upload-file ─────────────────────────
// Public endpoint: upload a single document during registration.
// Body: { fileData: "data:image/jpeg;base64,...", category: "nic_front", agentRef: "token-xyz" }
async function uploadRegistrationFile(req, res) {
  const { fileData, category, agentRef } = req.body;
  const allowed = ['nic_front','nic_back','agent_photo','bank_book','signed_agreement'];
  if (!fileData) return res.status(400).json({ error: 'fileData is required' });
  if (!allowed.includes(category)) return res.status(400).json({ error: 'Invalid category' });

  try {
    const ext    = fileData.startsWith('data:application/pdf') ? 'pdf'
                 : fileData.startsWith('data:image/png')       ? 'png' : 'jpg';
    const ts     = Date.now();
    const dest   = `agents/registration/${agentRef || 'tmp'}/${category}_${ts}.${ext}`;
    const url    = await uploadFile(fileData, dest);
    res.json({ url });
  } catch (err) {
    console.error('uploadRegistrationFile error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}

// ── POST /api/agent-auth/register ─────────────────────────────
async function register(req, res) {
  const {
    token,
    // Personal
    full_name, nic_number, driving_license_number, phone, district,
    // Document URLs (uploaded beforehand via uploadRegistrationFile)
    nic_front_url, nic_back_url, agent_photo_url, bank_book_url, signed_agreement_url,
    // Bank
    bank_name, account_holder, bank_account, bank_branch,
    // Credentials
    email, password,
  } = req.body;

  if (!token) return res.status(400).json({ error: 'Registration token is required' });
  if (!full_name || !nic_number || !email || !password) {
    return res.status(400).json({ error: 'full_name, nic_number, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Validate token
    const { rows: tokenRows } = await client.query(
      `SELECT id, used_at, expires_at
         FROM agent_registration_tokens
        WHERE token = $1
        FOR UPDATE`,
      [token]
    );
    if (tokenRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid registration token' });
    }
    const tok = tokenRows[0];
    if (tok.used_at) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'This registration link has already been used' });
    }
    if (new Date(tok.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'Registration link has expired' });
    }

    // Check email uniqueness
    const { rows: existing } = await client.query(
      `SELECT id FROM sales_agents WHERE email = $1`, [email.toLowerCase().trim()]
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);

    const { rows: agentRows } = await client.query(
      `INSERT INTO sales_agents
         (name, email, phone, password_hash, district,
          nic_number, driving_license_number,
          nic_front_url, nic_back_url, agent_photo_url, bank_book_url, signed_agreement_url,
          bank_name, account_holder, bank_account, bank_branch,
          approval_status, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending',FALSE)
       RETURNING id, name, email, approval_status`,
      [
        full_name.trim(),
        email.toLowerCase().trim(),
        phone || null,
        hash,
        district || null,
        nic_number.trim(),
        driving_license_number || null,
        nic_front_url    || null,
        nic_back_url     || null,
        agent_photo_url  || null,
        bank_book_url    || null,
        signed_agreement_url || null,
        bank_name      || null,
        account_holder || null,
        bank_account   || null,
        bank_branch    || null,
      ]
    );
    const agent = agentRows[0];

    // Mark token as used
    await client.query(
      `UPDATE agent_registration_tokens SET used_at = NOW(), used_by = $1 WHERE id = $2`,
      [agent.id, tok.id]
    );

    // Insert wallet row
    await client.query(
      `INSERT INTO agent_wallet (agent_id) VALUES ($1) ON CONFLICT DO NOTHING`, [agent.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Registration submitted. Your account is pending admin approval.',
      agent_id: agent.id,
      name:     agent.name,
      email:    agent.email,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error('agent register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  } finally {
    client.release();
  }
}

// ── GET /api/agent-auth/agreement/:token ──────────────────────
// Streams a PDF agreement for the agent to download and sign
async function getAgreementPdf(req, res) {
  const { token } = req.params;
  const { full_name, nic_number } = req.query;

  if (!full_name || !nic_number) {
    return res.status(400).json({ error: 'full_name and nic_number are required' });
  }

  // Validate token still active
  try {
    const { rows } = await db.query(
      `SELECT used_at, expires_at FROM agent_registration_tokens WHERE token = $1`, [token]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Invalid token' });
    if (rows[0].used_at) return res.status(410).json({ error: 'Token already used' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="BillFlow_Agent_Agreement.pdf"`);

  const doc = new PDFDoc({ margin: 60, size: 'A4' });
  doc.pipe(res);

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('BILLFLOW', { align: 'center' });
  doc.fontSize(13).font('Helvetica').text('Sales Agent Agreement', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Date: ${today}`, { align: 'right' });
  doc.moveDown(1);
  doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
  doc.moveDown(1);

  // Parties
  doc.fontSize(11).font('Helvetica-Bold').text('1. PARTIES');
  doc.font('Helvetica').fontSize(10).moveDown(0.3);
  doc.text(`This Sales Agent Agreement ("Agreement") is entered into between:`);
  doc.moveDown(0.4);
  doc.text(`• BillFlow POS Solutions ("Company")`);
  doc.text(`• ${full_name.trim()} (NIC: ${nic_number.trim()}) ("Agent")`);
  doc.moveDown(1);

  // Appointment
  doc.font('Helvetica-Bold').fontSize(11).text('2. APPOINTMENT');
  doc.font('Helvetica').fontSize(10).moveDown(0.3);
  doc.text(
    'The Company hereby appoints the Agent as an authorized Sales Agent to market and onboard ' +
    'merchant shops onto the BillFlow POS platform within their assigned territory.'
  );
  doc.moveDown(1);

  // Responsibilities
  doc.font('Helvetica-Bold').fontSize(11).text('3. AGENT RESPONSIBILITIES');
  doc.font('Helvetica').fontSize(10).moveDown(0.3);
  const duties = [
    'Promote and onboard new merchant shops onto the BillFlow platform.',
    'Collect monthly subscription fees (LKR 2,500/month per shop) and remit to the Company.',
    'Maintain accurate records of all shops onboarded and payments collected.',
    'Provide basic training and support to onboarded merchants.',
    'Report any issues or disputes to the Company promptly.',
    'Act ethically and professionally at all times while representing BillFlow.',
  ];
  duties.forEach((d, i) => doc.text(`${i + 1}. ${d}`, { indent: 10 }));
  doc.moveDown(1);

  // Commission
  doc.font('Helvetica-Bold').fontSize(11).text('4. COMMISSION STRUCTURE');
  doc.font('Helvetica').fontSize(10).moveDown(0.3);
  doc.text('The Agent shall receive commissions as determined by the Company and communicated through the Agent Portal. Commissions are credited upon verification of collected payments by the Company.');
  doc.moveDown(1);

  // Confidentiality
  doc.font('Helvetica-Bold').fontSize(11).text('5. CONFIDENTIALITY');
  doc.font('Helvetica').fontSize(10).moveDown(0.3);
  doc.text('The Agent agrees to keep all merchant information, pricing, and business data strictly confidential and not to disclose such information to third parties.');
  doc.moveDown(1);

  // Termination
  doc.font('Helvetica-Bold').fontSize(11).text('6. TERMINATION');
  doc.font('Helvetica').fontSize(10).moveDown(0.3);
  doc.text('Either party may terminate this Agreement with 30 days written notice. The Company reserves the right to terminate immediately for breach of this Agreement.');
  doc.moveDown(1.5);

  // Signature section
  doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(11).text('7. SIGNATURES');
  doc.font('Helvetica').fontSize(10).moveDown(0.5);
  doc.text('By signing below, both parties agree to the terms of this Agreement.');
  doc.moveDown(2);

  // Signature lines
  const sigY = doc.y;
  doc.text('Agent Signature: ____________________________', 60, sigY);
  doc.text('Company Representative: ____________________', 300, sigY);
  doc.moveDown(1);
  doc.text(`Name: ${full_name.trim()}`, 60);
  doc.text('Name: BillFlow Admin', 300);
  doc.moveDown(1);
  doc.text('Date: ___________________________', 60);
  doc.text(`Date: ${today}`, 300);

  doc.end();
}

// ── POST /api/agents/me/upload-signed-agreement ───────────────
async function uploadSignedAgreement(req, res) {
  const agentId = req.agent.id;
  const { fileData } = req.body;
  if (!fileData) return res.status(400).json({ error: 'fileData is required' });
  try {
    const dest = `agents/${agentId}/signed_agreement_${Date.now()}.pdf`;
    const url  = await uploadFile(fileData, dest, 'application/pdf');

    await db.query(
      `UPDATE sales_agents
          SET signed_agreement_url = $1, agreement_generated_at = NOW()
        WHERE id = $2`,
      [url, agentId]
    );
    res.json({ url });
  } catch (err) {
    console.error('uploadSignedAgreement error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}

module.exports = {
  validateToken,
  uploadRegistrationFile,
  register,
  getAgreementPdf,
  uploadSignedAgreement,
};
