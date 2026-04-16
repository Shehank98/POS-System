const express = require('express');
const router  = express.Router();
const { getDailySummary } = require('../controllers/emailSummaryController');

// GET /api/email-summary/daily
// Called by Google Apps Script at 10 PM — no JWT, uses DAILY_SUMMARY_KEY header
router.get('/daily', getDailySummary);

module.exports = router;
