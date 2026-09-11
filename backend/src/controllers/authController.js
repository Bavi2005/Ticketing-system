const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const config = require('../config');
const publicUser = user => ({ id: user.id, email: user.email, name: user.name, role: user.role, branchId: user.branchId, branch: user.branch });
const tokenFor = user => jwt.sign({ userId: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
exports.login = async (req, res, next) => { try { const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || ''); const user = await prisma.user.findUnique({ where: { email }, include: { branch: true } }); if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' }); res.json({ token: tokenFor(user), user: publicUser(user) }); } catch (error) { next(error); } };
exports.me = async (req, res, next) => { try { const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { branch: true } }); if (!user) return res.status(404).json({ message: 'User not found' }); res.json(publicUser(user)); } catch (error) { next(error); } };
