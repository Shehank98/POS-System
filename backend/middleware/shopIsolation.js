/**
 * Shop isolation middleware.
 *
 * Attaches req.shopId from the JWT so every subsequent query
 * can filter by shop_id without trusting a user-supplied value.
 *
 * Must be used AFTER authMiddleware.
 */
function shopIsolation(req, res, next) {
  if (!req.user || !req.user.shop_id) {
    return res.status(403).json({ error: 'Shop context missing from token' });
  }
  req.shopId = req.user.shop_id;
  next();
}

module.exports = shopIsolation;
