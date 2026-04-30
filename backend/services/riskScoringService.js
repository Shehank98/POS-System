const db = require('../config/database');
const { createAdminNotification, ADMIN_TYPES } = require('../controllers/notificationController');

// Score thresholds
const THRESHOLDS = { low: 25, medium: 50, high: 75 };

function getRiskLevel(score) {
  if (score >= THRESHOLDS.high)   return 'critical';
  if (score >= THRESHOLDS.medium) return 'high';
  if (score >= THRESHOLDS.low)    return 'medium';
  return 'low';
}

/**
 * Recalculate risk score for one agent and persist it.
 * Called non-blocking after every suspicious/rejected payment event.
 */
async function recalculateRiskScore(agentId) {
  try {
    // Fetch live counters from actual data
    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_suspicious = TRUE)              AS mismatches,
        COUNT(*) FILTER (WHERE payment_detail_status = 'partial') AS partials,
        COUNT(*) FILTER (WHERE status = 'rejected')               AS rejected
      FROM agent_payment_submissions
      WHERE agent_id = $1
    `, [agentId]);

    const { rows: flagRows } = await db.query(
      `SELECT COUNT(*) AS flags FROM agent_payment_flags WHERE agent_id = $1`,
      [agentId]
    );

    const mismatches = parseInt(rows[0].mismatches, 10) || 0;
    const partials   = parseInt(rows[0].partials,   10) || 0;
    const rejected   = parseInt(rows[0].rejected,   10) || 0;
    const flags      = parseInt(flagRows[0].flags,  10) || 0;

    // Scoring formula (capped at 100)
    let score = 0;
    score += Math.min(mismatches * 25, 50); // max 50 from mismatches
    score += Math.min(partials   * 10, 20); // max 20 from partials
    score += Math.min(rejected   *  5, 10); // max 10 from rejections
    score += Math.min(flags      * 20, 20); // max 20 from audit flags
    score  = Math.min(score, 100);

    const level    = getRiskLevel(score);
    const isCritical = level === 'critical';
    const isHigh     = level === 'high';

    await db.query(`
      INSERT INTO agent_risk_scores
        (agent_id, risk_score, risk_level,
         payment_mismatches_count, partial_payments_count,
         rejected_payments_count,  fraud_flags_count,
         is_restricted, requires_admin_approval, last_calculated_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
      ON CONFLICT (agent_id) DO UPDATE
        SET risk_score               = $2,
            risk_level               = $3,
            payment_mismatches_count = $4,
            partial_payments_count   = $5,
            rejected_payments_count  = $6,
            fraud_flags_count        = $7,
            is_restricted            = CASE WHEN $8 THEN TRUE ELSE agent_risk_scores.is_restricted END,
            requires_admin_approval  = $9 OR agent_risk_scores.requires_admin_approval,
            last_calculated_at       = NOW(),
            updated_at               = NOW()
    `, [agentId, score, level, mismatches, partials, rejected, flags, isCritical, isHigh || isCritical]);

    // Fire admin alerts when escalating
    if (isCritical) {
      const { rows: agRows } = await db.query(`SELECT name FROM sales_agents WHERE id = $1`, [agentId]);
      const name = agRows[0]?.name || `Agent #${agentId}`;
      createAdminNotification(
        ADMIN_TYPES.AGENT_RESTRICTED,
        'Agent Auto-Restricted',
        `${name} has been auto-restricted due to high risk score (${score}/100). Requires manual review.`,
        'critical',
        { agent_id: agentId, risk_score: score, risk_level: level }
      );
      // Restrict agent login
      await db.query(
        `UPDATE sales_agents SET is_active = FALSE WHERE id = $1 AND is_active = TRUE`,
        [agentId]
      );
    }

    return { score, level };
  } catch (err) {
    console.error('[RiskScoring] Failed to recalculate for agent', agentId, err.message);
    return null;
  }
}

/**
 * Get the current risk score row for an agent (creates default if missing).
 */
async function getOrCreateRiskScore(agentId) {
  await db.query(
    `INSERT INTO agent_risk_scores (agent_id) VALUES ($1) ON CONFLICT (agent_id) DO NOTHING`,
    [agentId]
  );
  const { rows } = await db.query(
    `SELECT * FROM agent_risk_scores WHERE agent_id = $1`,
    [agentId]
  );
  return rows[0] || null;
}

module.exports = { recalculateRiskScore, getOrCreateRiskScore, getRiskLevel, THRESHOLDS };
