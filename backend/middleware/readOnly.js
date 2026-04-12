/**
 * Blocks state-changing operations when the shop is in read-only mode
 * (subscription expired > 3 days).  Must be used after authMiddleware.
 */
function readOnlyGuard(req, res, next) {
  if (req.user && req.user.read_only) {
    return res.status(403).json({
      error: 'Your subscription has expired. Upgrade to continue making changes.',
      code:  'READ_ONLY_MODE',
    });
  }
  next();
}

module.exports = readOnlyGuard;
