const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const config = require('../config');
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, include: { branch: true } });
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user; next();
  } catch { return res.status(401).json({ message: 'Invalid or expired session' }); }
};
module.exports = { auth };
