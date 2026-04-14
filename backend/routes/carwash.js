const express    = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const readOnly   = require('../middleware/readOnly');
const ctrl       = require('../controllers/carwashController');

const router = express.Router();

// All car-wash routes require a valid shop JWT
router.use(authMiddleware, shopIsolation);

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', ctrl.getDashboard);

// ── Staff View ────────────────────────────────────────────────
router.get('/staff/my-view', ctrl.getStaffView);

// ── Services ─────────────────────────────────────────────────
router.get   ('/services',     ctrl.listServices);
router.post  ('/services',     readOnly, requireRole('owner','manager'), ctrl.createService);
router.put   ('/services/:id', readOnly, requireRole('owner','manager'), ctrl.updateService);
router.delete('/services/:id', readOnly, requireRole('owner','manager'), ctrl.deleteService);

// ── Products ─────────────────────────────────────────────────
router.get   ('/products',     ctrl.listProducts);
router.post  ('/products',     readOnly, requireRole('owner','manager'), ctrl.createProduct);
router.put   ('/products/:id', readOnly, requireRole('owner','manager'), ctrl.updateProduct);
router.delete('/products/:id', readOnly, requireRole('owner','manager'), ctrl.deleteProduct);

// ── Jobs ─────────────────────────────────────────────────────
router.get ('/jobs',                  ctrl.listJobs);
router.get ('/jobs/:id',              ctrl.getJob);
router.post('/jobs',                  readOnly, ctrl.createJob);
router.put ('/jobs/:id/status',       readOnly, ctrl.updateJobStatus);
router.post('/jobs/:id/items',        readOnly, ctrl.addJobItem);
router.delete('/jobs/:id/items/:itemId', readOnly, ctrl.removeJobItem);
router.post('/jobs/:id/pay',          readOnly, ctrl.payJob);

// ── Bookings ─────────────────────────────────────────────────
router.get ('/bookings',               ctrl.listBookings);
router.post('/bookings',               readOnly, ctrl.createBooking);
router.put ('/bookings/:id',           readOnly, ctrl.updateBooking);
router.put ('/bookings/:id/status',    readOnly, ctrl.updateBookingStatus);
router.post('/bookings/:id/convert',   readOnly, ctrl.convertBooking);

module.exports = router;
