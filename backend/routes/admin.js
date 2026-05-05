const router      = require('express').Router();
const adminAuth   = require('../middleware/adminAuth');
const ctrl        = require('../controllers/adminController');
const auditCtrl   = require('../controllers/auditController');
const agentCtrl   = require('../controllers/adminAgentController');
const notifCtrl   = require('../controllers/notificationController');

// Public admin login
router.post('/login', ctrl.adminLogin);

// All routes below require super-admin JWT
router.use(adminAuth);

router.get('/dashboard',                    ctrl.getDashboard);
router.get('/financial-summary',            ctrl.getFinancialSummary);
router.get('/analysis',                     ctrl.getAnalysis);

// Shop management
router.get('/shops',                        ctrl.listShops);
router.post('/shops',                       ctrl.createShop);
router.get('/shops/:id',                          ctrl.getShop);
router.put('/shops/:id',                          ctrl.updateShop);
router.put('/shops/:id/subscription',             ctrl.updateSubscription);
router.get('/shops/:id/sales',                    ctrl.getShopSales);
router.get('/shops/:id/agent-info',               ctrl.getShopAgentInfo);
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

// Subscription plans
router.get('/plans',                        ctrl.getPlans);
router.post('/plans',                       ctrl.createPlan);
router.put('/plans/:id',                    ctrl.updatePlan);
router.delete('/plans/:id',                 ctrl.deletePlan);

// Admin notification dispatch (legacy broadcast to shops)
router.post('/notifications/dispatch',                  ctrl.dispatchNotification);

// Admin-facing notifications (new shop onboards, payments, fraud alerts)
router.get ('/notifications',                           notifCtrl.getAdminNotifications);
router.put ('/notifications/read-all',                  notifCtrl.markAllAdminNotificationsRead);
router.put ('/notifications/:id/read',                  notifCtrl.markAdminNotificationRead);

// ── Sales Agent management ────────────────────────────────────
router.get ('/agents',                      agentCtrl.listAgents);
router.post('/agents',                      agentCtrl.createAgent);
router.put ('/agents/:id',                  agentCtrl.updateAgent);
router.get ('/agents/:id/customers',        agentCtrl.getAgentCustomers);

// Agent payment submissions
router.get ('/agent-payments/fraud-summary', agentCtrl.getFraudSummary);
router.get ('/agent-payments/pending',       agentCtrl.listPendingPayments);
router.get ('/agent-payments',               agentCtrl.listAllPayments);
router.put ('/agent-payments/:id/verify',    agentCtrl.verifyPayment);
router.put ('/agent-payments/:id/reject',    agentCtrl.rejectPayment);

// Agent commissions
router.get ('/agent-commissions',           agentCtrl.listCommissions);
router.put ('/agent-commissions/payout',    agentCtrl.markPayout);

// Agent risk scores
router.get ('/agent-risk-scores',           agentCtrl.listRiskScores);
router.put ('/agent-risk-scores/:agentId/recalculate', agentCtrl.recalculateAgentRisk);
router.put ('/agent-risk-scores/:agentId/restrict',    agentCtrl.setAgentRestriction);

// ── Agent Registration & Approval ────────────────────────────
const shopPayCtrl = require('../controllers/shopPaymentController');

router.post('/generate-agent-invite',       agentCtrl.generateInviteToken);
router.get ('/invite-tokens',               agentCtrl.listInviteTokens);
router.get ('/agent-registrations',         agentCtrl.listPendingRegistrations);
router.get ('/agents/:id/documents',               agentCtrl.getAgentDocuments);
router.put ('/agents/:id/approve',                 agentCtrl.approveAgentRegistration);
router.put ('/agents/:id/reject',                  agentCtrl.rejectAgentRegistration);
router.put ('/agents/:id/signed-agreement',        agentCtrl.saveSignedAgreementUrl);

// ── Shops by Agent / Shop Map ─────────────────────────────────
router.get ('/shops-by-agent',              agentCtrl.getShopsByAgent);
router.get ('/shops/map-data',              agentCtrl.getShopsMapData);

// ── Shop Payment Proofs (LKR 2500/month activation) ──────────
router.get ('/shop-payments',               shopPayCtrl.adminListShopPayments);
router.put ('/shop-payments/:id/verify',    shopPayCtrl.adminVerifyShopPayment);
router.put ('/shop-payments/:id/reject',    shopPayCtrl.adminRejectShopPayment);
router.put ('/shop-payments/:id/helaPay-verify', shopPayCtrl.adminVerifyHelaPay);

module.exports = router;
