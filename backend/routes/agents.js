const router    = require('express').Router();
const agentAuth = require('../middleware/agentAuth');
const ctrl      = require('../controllers/agentController');
const notifCtrl = require('../controllers/notificationController');

router.use(agentAuth);

router.get ('/me/dashboard',                     ctrl.getDashboard);
router.get ('/me/customers',                     ctrl.listCustomers);
router.post('/me/customers',                     ctrl.onboardCustomer);
router.put ('/me/customers/:shopId',             ctrl.editCustomer);
router.post('/me/payments',                      ctrl.submitPayment);
router.get ('/me/payments',                      ctrl.listPayments);
router.get ('/me/commissions',                   ctrl.listCommissions);
router.put ('/me/bank-details',                  ctrl.updateBankDetails);
router.get ('/me/renewals',                      ctrl.getRenewals);
router.get ('/me/plans',                         ctrl.listPlans);
router.get ('/me/notifications',                 notifCtrl.getAgentNotifications);
router.put ('/me/notifications/read-all',        notifCtrl.markAllAgentNotificationsRead);
router.put ('/me/notifications/:id/read',        notifCtrl.markAgentNotificationRead);

module.exports = router;
