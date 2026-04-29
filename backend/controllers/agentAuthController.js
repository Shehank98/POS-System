const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/database');

// ── POST /api/agent-auth/login ────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, phone, password_hash, district, monthly_target,
              bank_name, bank_account, bank_branch, account_holder, is_active
         FROM sales_agents WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const agent = rows[0];
    if (!agent.is_active) {
      return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
    }
    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: agent.id, role: 'sales_agent', email: agent.email, name: agent.name, district: agent.district },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      agent: {
        id:              agent.id,
        name:            agent.name,
        email:           agent.email,
        phone:           agent.phone,
        district:        agent.district,
        monthly_target:  agent.monthly_target,
        bank_name:       agent.bank_name,
        bank_account:    agent.bank_account,
        bank_branch:     agent.bank_branch,
        account_holder:  agent.account_holder,
      },
    });
  } catch (err) {
    console.error('agent login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
}

// ── GET /api/agent-auth/me ────────────────────────────────────
async function getMe(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, phone, district, monthly_target,
              bank_name, bank_account, bank_branch, account_holder, created_at
         FROM sales_agents WHERE id = $1`,
      [req.agent.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('agent getMe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { login, getMe };
