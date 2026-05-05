const router   = require('express').Router();
const { authMiddleware: auth } = require('../middleware/auth');
const ctrl     = require('../controllers/shopPaymentController');

// Shop owner routes (authenticated as shop user)
router.post('/upload-proof', auth, ctrl.uploadPaymentProof);
router.get ('/my-proofs',    auth, ctrl.listMyProofs);

module.exports = router;
