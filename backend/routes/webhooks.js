const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl   = require('../controllers/helapayWebhookController');

// Public — no auth, signature is verified inside the controller
router.post('/helapay', ctrl.handleHelaPay);

// Admin-only — webhook log viewer for debugging
router.get('/logs', adminAuth, ctrl.getWebhookLogs);

module.exports = router;
