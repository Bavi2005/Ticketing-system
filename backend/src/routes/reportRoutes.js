const express = require("express");
const { rateLimit } = require("express-rate-limit");
const prisma = require("../utils/prisma");
const { publicReport } = require("../utils/publicReport");
const router = express.Router();
router.get("/public", rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false }), async (req, res, next) => {
  try {
    const now = new Date();
    const year = new Date(now.getTime() + 8 * 3600000).getUTCFullYear();
    // Include prior-year openings that closed this year, and the cross-year last-7-days window.
    const since = new Date(Math.min(new Date(`${year}-01-01T00:00:00+08:00`).getTime(), now.getTime() - 8 * 86400000));
    const [tickets, latest] = await Promise.all([
      prisma.ticket.findMany({ where: { OR: [{ createdAt: { gte: since } }, { closedAt: { gte: since } }] }, select: { createdAt: true, closedAt: true, status: true } }),
      prisma.ticket.findMany({ take: 6, orderBy: { createdAt: "desc" }, select: { category: true, status: true, createdAt: true, resolvedAt: true, closedAt: true, branch: { select: { name: true, zone: true } } } }),
    ]);
    res.json(publicReport(tickets, latest, now));
  } catch (e) { next(e); }
});
module.exports = router;
