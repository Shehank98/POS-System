const router      = require('express').Router();
const adminAuth   = require('../middleware/adminAuth');
const ctrl        = require('../controllers/adminController');
const auditCtrl   = require('../controllers/auditController');

// Public admin login
router.post('/login', ctrl.adminLogin);

// All routes below require super-admin JWT
router.use(adminAuth);

router.get('/dashboard',                    ctrl.getDashboard);
router.get('/analysis',                     ctrl.getAnalysis);

// Shop management
router.get('/shops',                        ctrl.listShops);
router.post('/shops',                       ctrl.createShop);
router.get('/shops/:id',                          ctrl.getShop);
router.put('/shops/:id',                          ctrl.updateShop);
router.put('/shops/:id/subscription',             ctrl.updateSubscription);
router.get('/shops/:id/sales',                    ctrl.getShopSales);
router.delete('/shops/:id',                           ctrl.deleteShop);
router.get('/shops/:id/users',                        ctrl.getShopUsers);
router.post('/shops/:id/users',                       ctrl.addShopUser);
router.delete('/shops/:id/users/:userId',             ctrl.deleteShopUser);
router.put('/shops/:id/users/:userId/password',       ctrl.changeUserPassword);

// Payment management
router.get('/payments',                     ctrl.listPayments);
router.get('/payments/:id/proof',           ctrl.getPaymentProof);
router.put('/payments/:id/verify',          ctrl.verifyPayment);
router.put('/payments/:id/reject',          ctrl.rejectPayment);

// Audit log (all shops)
router.get('/audit-log',                    auditCtrl.getAdminAuditLog);

module.exports = router;
