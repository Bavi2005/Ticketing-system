const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const config = require("../config");
const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  branchId: user.branchId,
  branch: user.branch,
});
const tokenFor = (user) =>
  jwt.sign({ userId: user.id, role: user.role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
exports.login = async (req, res, next) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    const user = await prisma.user.findUnique({
      where: { email },
      include: { branch: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ message: "Invalid email or password" });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};
exports.me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { branch: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
};
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { branch: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : undefined;
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : undefined;
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const update = {};

    if (name !== undefined) {
      if (name.length < 2)
        return res
          .status(400)
          .json({ message: "Name must be at least 2 characters" });
      update.name = name;
    }

    if (email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ message: "Invalid email address" });
      if (email !== user.email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing)
          return res.status(409).json({ message: "Email already in use" });
      }
      update.email = email;
    }

    if (newPassword) {
      if (newPassword.length < 6)
        return res
          .status(400)
          .json({ message: "New password must be at least 6 characters" });
      if (!currentPassword)
        return res
          .status(400)
          .json({ message: "Current password is required to change password" });
      if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
        return res
          .status(401)
          .json({ message: "Current password is incorrect" });
      update.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (!Object.keys(update).length)
      return res.json({ token: tokenFor(user), user: publicUser(user) });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: update,
      include: { branch: true },
    });
    res.json({ token: tokenFor(updated), user: publicUser(updated) });
  } catch (error) {
    next(error);
  }
};
