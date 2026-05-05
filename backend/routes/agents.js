const router    = require('express').Router();
const agentAuth = require('../middleware/agentAuth');
const ctrl      = require('../controllers/agentController');
const notifCtrl = require('../controllers/notificationController');

// Public: selfie upload before shop registration (no auth needed)
router.post('/shops/upload-selfie', ctrl.uploadShopSelfie);

router.use(agentAuth);

// Dashboard
router.get ('/me/dashboard',                     ctrl.getDashboard);

// Customers (legacy onboarding)
router.get ('/me/customers',                     ctrl.listCustomers);
router.post('/me/customers',                     ctrl.onboardCustomer);
router.put ('/me/customers/:shopId',             ctrl.editCustomer);

// Shop registration (new full flow with location + reference ID)
router.get ('/me/shops',                         ctrl.listShops);
router.post('/me/shops/register',                ctrl.registerShop);
router.post('/me/shops/:shopId/payment-qr',      ctrl.generateShopPaymentQR);
router.get ('/me/shops/:shopId/payments',        ctrl.listShopPayments);

// Payments (agent collects cash)
router.post('/me/payments',                      ctrl.submitPayment);
router.get ('/me/payments',                      ctrl.listPayments);

// Commissions
router.get ('/me/commissions',                   ctrl.listCommissions);

// Profile
router.put ('/me/bank-details',                  ctrl.updateBankDetails);
router.get ('/me/renewals',                      ctrl.getRenewals);
router.get ('/me/plans',                         ctrl.listPlans);

// Notifications
router.get ('/me/notifications',                 notifCtrl.getAgentNotifications);
router.put ('/me/notifications/read-all',        notifCtrl.markAllAgentNotificationsRead);
router.put ('/me/notifications/:id/read',        notifCtrl.markAgentNotificationRead);

module.exports = router;
