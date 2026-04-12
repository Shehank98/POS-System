const jwt = require('jsonwebtoken');

/**
 * Verifies JWT on every protected route.
 * Attaches decoded payload to req.user.
 */
function authMiddleware(req, res, next) {
  // Accept token from Authorization header OR ?token= query param
  // (query param is needed for window.open receipt links)
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, shop_id, role, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role guard factory.
 * Usage: router.delete('/...', authMiddleware, requireRole('owner','manager'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
