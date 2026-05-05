const router   = require('express').Router();
const auth     = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const ctrl     = require('../controllers/shopPaymentController');

// Shop owner routes (authenticated as shop user)
router.post('/upload-proof', auth, ctrl.uploadPaymentProof);
router.get ('/my-proofs',    auth, ctrl.listMyProofs);

// Admin routes (mounted separately in server.js under /api/admin)
// These are exported for use in admin router
module.exports = router;
module.exports.adminCtrl = ctrl;
