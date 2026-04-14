const express = require('express');
const ctrl    = require('../controllers/carwashController');

const router = express.Router();

// No auth required — these are accessed by customers via QR links

router.get ('/lookup',   ctrl.publicLookup);
router.get ('/shop-info', ctrl.publicShopInfo);
router.post('/bookings', ctrl.publicCreateBooking);

module.exports = router;
