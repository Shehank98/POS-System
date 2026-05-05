const router   = require('express').Router();
const { authMiddleware: auth } = require('../middleware/auth');
const ctrl     = require('../controllers/shopPaymentController');

// Shop owner routes (authenticated as shop user)
// Note: these bypass activationGuard (whitelisted in middleware/activationGuard.js)
router.post('/upload-proof',               auth, ctrl.uploadPaymentProof);
router.get ('/my-proofs',                  auth, ctrl.listMyProofs);
router.post('/generate-billing-qr',        auth, ctrl.generateBillingQR);
router.get ('/billing-qr-status/:reference', auth, ctrl.getBillingQRStatus);

module.exports = router;
