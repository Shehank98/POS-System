const router          = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation   = require('../middleware/shopIsolation');
const ctrl            = require('../controllers/qrPaymentController');

// Public — no auth required
router.post('/webhook',            ctrl.handleWebhook);
router.get('/display/:reference',  ctrl.getDisplayStatus);

// All remaining routes require auth + shop isolation
router.use(authMiddleware, shopIsolation);

router.get('/config',              requireRole('owner'), ctrl.getConfig);
router.put('/config',              requireRole('owner'), ctrl.saveConfig);
router.post('/test',               requireRole('owner'), ctrl.testConnection);
router.post('/generate',           ctrl.generateQR);
router.get('/status/:reference',   ctrl.checkStatus);

module.exports = router;
