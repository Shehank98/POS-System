const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation                   = require('../middleware/shopIsolation');
const ctrl                            = require('../controllers/qrPaymentController');

// Public routes — no auth
router.post('/webhook',           ctrl.handleWebhook);
router.get('/display/:reference', ctrl.getDisplayStatus);

// Authenticated routes
router.use(authMiddleware, shopIsolation);

router.get('/config',            requireRole('owner'), ctrl.getConfig);
router.put('/config',            requireRole('owner'), ctrl.saveConfig);
router.post('/generate',         ctrl.generateQR);
router.get('/status/:reference', ctrl.checkStatus);

module.exports = router;
