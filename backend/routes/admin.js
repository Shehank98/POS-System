const router    = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl      = require('../controllers/adminController');

// Public admin login
router.post('/login', ctrl.adminLogin);

// All routes below require super-admin JWT
router.use(adminAuth);

router.get('/dashboard',                    ctrl.getDashboard);

// Shop management
router.get('/shops',                        ctrl.listShops);
router.post('/shops',                       ctrl.createShop);
router.get('/shops/:id',                    ctrl.getShop);
router.put('/shops/:id',                    ctrl.updateShop);
router.put('/shops/:id/subscription',       ctrl.updateSubscription);
router.get('/shops/:id/sales',              ctrl.getShopSales);

// Payment management
router.get('/payments',                     ctrl.listPayments);
router.put('/payments/:id/verify',          ctrl.verifyPayment);

module.exports = router;
