const { randomUUID } = require("crypto");
const prisma = require("../utils/prisma");
const {
  categories,
  zones,
  statuses,
  sla,
  zoneOf,
  completed,
  missed,
  scope,
  filters,
  matches,
  fail,
} = require("../utils/ticketing");
const include = {
  branch: true,
  requester: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  comments: {
    include: { author: { select: { name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  },
};
const sanitize = (ticket, user) => ({
  ...ticket,
  comments: ticket.comments.filter((c) => user.role !== "STAFF" || !c.internal),
});
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};
exports.metadata = handle(async (req, res) => {
  const branches = await prisma.branch.findMany({
    where:
      req.user.role === "HQ_ADMIN" || req.user.role === "STAFF"
        ? {}
        : { id: req.user.branchId || "__NO_BRANCH__" },
    orderBy: { name: "asc" },
  });
  const submissionBranches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
  });
  res.json({
    categories,
    zones,
    branches: branches.map((b) => ({ ...b, zone: zoneOf(b) })),
    submissionBranches: submissionBranches.map((b) => ({
      id: b.id,
      name: b.name,
      zone: zoneOf(b),
    })),
  });
});
exports.dashboard = handle(async (req, res) => {
  const now = new Date();
  const tickets = (
    await prisma.ticket.findMany({
      where: filters(req.query, req.user),
      include: { branch: true },
    })
  ).filter((t) => matches(t, { zone: req.query.zone }, now));
  const resolved = tickets.filter(completed).length;
  const missedCount = tickets.filter((t) => missed(t, now)).length;
  const buckets = new Map();
  // Trends describe the current outcome of tickets created on each Malaysia date.
  for (const t of tickets) {
    const date = new Date(new Date(t.createdAt).getTime() + 8 * 3600000)
      .toISOString()
      .slice(0, 10);
    const b = buckets.get(date) || { date, resolved: 0, unresolved: 0 };
    b[completed(t) ? "resolved" : "unresolved"]++;
    buckets.set(date, b);
  }
  res.json({
    total: tickets.length,
    unresolved: tickets.length - resolved,
    resolved,
    missed: missedCount,
    within: tickets.length - missedCount,
    trend: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)),
    categories: categories.map((name) => ({
      name,
      count: tickets.filter(
        (t) =>
          t.category === name && matches(t, { metric: req.query.metric }, now),
      ).length,
    })),
    generatedAt: now,
  });
});
exports.list = handle(async (req, res) => {
  const now = new Date();
  const tickets = await prisma.ticket.findMany({
    where: filters(req.query, req.user),
    include,
    orderBy: [{ createdAt: "desc" }],
  });
  res.json(
    tickets
      .filter((t) => matches(t, req.query, now))
      .map((t) => ({ ...sanitize(t, req.user), slaMissed: missed(t, now) })),
  );
});
exports.create = handle(async (req, res) => {
  const {
    title,
    description,
    category,
    priority = "MEDIUM",
    branchId,
    zone,
  } = req.body;
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 180 ||
    typeof description !== "string" ||
    !description.trim() ||
    description.length > 10000 ||
    !categories.includes(category) ||
    !Object.hasOwn(sla, priority) ||
    !zones.includes(zone)
  )
    fail(
      "Provide a title, description, valid service category, priority and zone",
    );
  const targetId = branchId || req.user.branchId;
  const branch =
    targetId && (await prisma.branch.findUnique({ where: { id: targetId } }));
  if (!branch || zoneOf(branch) !== zone)
    fail("Select a branch within the chosen zone");
  const [respond, resolve] = sla[priority];
  const now = Date.now();
  const ticket = await prisma.ticket.create({
    data: {
      reference: `ENG-${randomUUID().slice(0, 8).toUpperCase()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      branchId: branch.id,
      requesterId: req.user.id,
      responseDueAt: new Date(now + respond * 3600000),
      resolutionDueAt: new Date(now + resolve * 3600000),
    },
    include,
  });
  res.status(201).json(sanitize(ticket, req.user));
});
exports.update = handle(async (req, res) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: req.params.id, ...scope(req.user) },
  });
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  if (!["BRANCH_MANAGER", "HQ_ADMIN"].includes(req.user.role))
    return res
      .status(403)
      .json({ message: "Only managers can update ticket workflow" });
  const { status, assigneeId } = req.body;
  const data = {};
  if (status !== undefined) {
    if (!statuses.includes(status)) fail("Invalid status");
    data.status = status;
    if (status !== "NEW" && !ticket.acknowledgedAt)
      data.acknowledgedAt = new Date();
    if (["RESOLVED", "CLOSED"].includes(status))
      data.resolvedAt = ticket.resolvedAt || new Date();
    else {
      data.resolvedAt = null;
      data.closedAt = null;
    }
    if (status === "CLOSED") data.closedAt = ticket.closedAt || new Date();
    else data.closedAt = null;
  }
  if (assigneeId !== undefined) {
    if (assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: assigneeId,
          OR: [{ branchId: ticket.branchId }, { role: "HQ_ADMIN" }],
        },
      });
      if (!assignee) fail("Assignee must belong to this branch or HQ");
    }
    data.assigneeId = assigneeId || null;
  }
  if (!Object.keys(data).length) fail("No workflow changes provided");
  res.json(
    await prisma.ticket.update({ where: { id: ticket.id }, data, include }),
  );
});
exports.comment = handle(async (req, res) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: req.params.id, ...scope(req.user) },
  });
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  const message =
    typeof req.body.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 5000)
    fail("Comment must contain 1–5,000 characters");
  res.status(201).json(
    await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: req.user.id,
        message,
        internal: req.body.internal === true && req.user.role !== "STAFF",
      },
      include: { author: { select: { name: true, role: true } } },
    }),
  );
});
