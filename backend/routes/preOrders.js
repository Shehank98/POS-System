const router        = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const shopIsolation   = require('../middleware/shopIsolation');
const ctrl            = require('../controllers/preOrderController');

// ── Public routes (no auth — customers ordering via QR) ───────
router.get('/public/products',             ctrl.getPublicProducts);
router.get('/public/shop',                 ctrl.getPublicShop);
router.get('/public/history',              ctrl.getOrderHistory);
router.get('/public/track',                ctrl.getPublicTrack);
router.get('/public/cancellation-status',  ctrl.getCancellationStatus);
router.post('/public',                     ctrl.createPreOrder);
router.post('/public/cancel',              ctrl.publicCancelOrder);

// ── Authenticated routes (shop owner / POS staff) ─────────────
router.use(authMiddleware, shopIsolation);

router.get('/stats',           ctrl.getStats);
router.get('/counts',          ctrl.getStatusCounts);
router.get('/',                ctrl.listPreOrders);
router.get('/by-token/:token', ctrl.getByToken);
router.put('/:id/status',      ctrl.updateStatus);
router.put('/:id/pay',         ctrl.markAsPaid);

module.exports = router;
