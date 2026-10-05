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
  const branchWhere =
    req.user.role === "BRANCH_MANAGER"
      ? {
          zone:
            req.user.zone ||
            (req.user.branch && zoneOf(req.user.branch)) ||
            "__NO_ZONE__",
        }
      : req.user.role === "STAFF"
        ? { id: req.user.branchId || "__NO_BRANCH__" }
        : {};
  const branches = await prisma.branch.findMany({
    where: branchWhere,
    orderBy: { name: "asc" },
  });
  const submissionBranches = branches;
  const assignees =
    req.user.role === "STAFF"
      ? []
      : await prisma.user.findMany({
          where: {
            OR: [
              { role: "HQ_ADMIN" },
              {
                role: "STAFF",
                ...(req.user.operatorId || req.user.ownedOperator
                  ? {
                      operatorId:
                        req.user.operatorId || req.user.ownedOperator.id,
                    }
                  : {}),
                ...(req.user.role === "BRANCH_MANAGER"
                  ? { branch: branchWhere }
                  : {}),
              },
            ],
          },
          select: { id: true, name: true, role: true, branchId: true },
          orderBy: { name: "asc" },
        });
  res.json({
    categories,
    assignees,
    zones: [...new Set(branches.map(zoneOf))],
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
  if (req.user.role === "STAFF" && branchId && branchId !== req.user.branchId)
    return res
      .status(403)
      .json({ message: "Your assigned branch cannot be changed" });
  const targetId =
    req.user.role === "STAFF"
      ? req.user.branchId
      : branchId || req.user.branchId;
  const branch =
    targetId && (await prisma.branch.findUnique({ where: { id: targetId } }));
  if (!branch || zoneOf(branch) !== zone)
    fail("Select a branch within the chosen zone");
  if (
    req.user.role === "BRANCH_MANAGER" &&
    zoneOf(branch) !== (req.user.zone || zoneOf(req.user.branch))
  )
    return res
      .status(403)
      .json({ message: "Branch is outside your assigned zone" });
  const [respond, resolve] = sla[priority];
  const now = Date.now();
  const ticket = await prisma.ticket.create({
    data: {
      reference: `ENG-${randomUUID().slice(0, 8).toUpperCase()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      status: "IN_PROGRESS",
      acknowledgedAt: new Date(now),
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
  const user = req.user;
  const ticket = await prisma.ticket.findFirst({
    where: { id: req.params.id, ...scope(user) },
  });
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  const { status, assigneeId, priority, branchId, escalateToHq } = req.body;
  const manager = ["BRANCH_MANAGER", "HQ_ADMIN", "OPERATOR"].includes(
    user.role,
  );
  if (
    !manager &&
    (assigneeId !== undefined ||
      priority !== undefined ||
      branchId !== undefined ||
      escalateToHq !== undefined ||
      !["IN_PROGRESS", "WAITING", "RESOLVED"].includes(status) ||
      completed(ticket))
  )
    return res
      .status(403)
      .json({
        message: "Technicians can resume, wait or resolve active tickets only",
      });
  const data = {};
  const now = new Date();
  if (status !== undefined) {
    if (!statuses.includes(status)) fail("Invalid status");
    if (
      status === "CLOSED" &&
      ticket.status !== "RESOLVED" &&
      user.role !== "HQ_ADMIN"
    )
      fail("Resolve the ticket before closing it");
    data.status = status;
    if (!ticket.acknowledgedAt) data.acknowledgedAt = now;
    if (ticket.waitingSince && status !== "WAITING") {
      const paused = Math.max(0, now - new Date(ticket.waitingSince));
      data.responseDueAt = new Date(
        new Date(ticket.responseDueAt).getTime() + paused,
      );
      data.resolutionDueAt = new Date(
        new Date(ticket.resolutionDueAt).getTime() + paused,
      );
      data.waitingSince = null;
    } else if (status === "WAITING" && !ticket.waitingSince)
      data.waitingSince = now;
    if (["RESOLVED", "CLOSED"].includes(status))
      data.resolvedAt = ticket.resolvedAt || now;
    else {
      data.resolvedAt = null;
      data.closedAt = null;
    }
    data.closedAt = status === "CLOSED" ? ticket.closedAt || now : null;
  }
  if (priority !== undefined) {
    if (!Object.hasOwn(sla, priority)) fail("Invalid priority");
    data.priority = priority;
    // Keep elapsed work and completed pauses when criticality changes.
    const old = sla[ticket.priority];
    if (old) {
      data.responseDueAt = new Date(
        new Date(data.responseDueAt || ticket.responseDueAt).getTime() +
          (sla[priority][0] - old[0]) * 3600000,
      );
      data.resolutionDueAt = new Date(
        new Date(data.resolutionDueAt || ticket.resolutionDueAt).getTime() +
          (sla[priority][1] - old[1]) * 3600000,
      );
    }
  }
  if (branchId !== undefined) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) fail("Unknown branch");
    if (
      user.role === "BRANCH_MANAGER" &&
      zoneOf(branch) !== (user.zone || zoneOf(user.branch))
    )
      return res
        .status(403)
        .json({ message: "Branch is outside your assigned zone" });
    data.branchId = branchId;
    if (branchId !== ticket.branchId) data.assigneeId = null;
  }
  if (assigneeId !== undefined) {
    if (assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: assigneeId,
          OR: [
            { role: "HQ_ADMIN" },
            {
              role: "STAFF",
              branchId: data.branchId || ticket.branchId,
              ...(user.operatorId || user.ownedOperator
                ? { operatorId: user.operatorId || user.ownedOperator.id }
                : {}),
            },
          ],
        },
      });
      if (!assignee)
        fail("Assignee must be an eligible technician in this branch or HQ");
    }
    data.assigneeId = assigneeId || null;
  }
  if (escalateToHq !== undefined) {
    if (escalateToHq !== true) fail("Invalid escalation");
    const hq = await prisma.user.findFirst({
      where: { role: "HQ_ADMIN" },
      orderBy: { createdAt: "asc" },
    });
    if (!hq) fail("No HQ account is available for escalation");
    data.assigneeId = hq.id;
    data.escalatedAt = now;
  }
  if (!Object.keys(data).length) fail("No workflow changes provided");
  // Optimistic lock prevents simultaneous resumes from crediting a pause twice.
  const updated = await prisma.ticket.updateMany({
    where: { id: ticket.id, updatedAt: ticket.updatedAt },
    data,
  });
  if (!updated.count)
    return res
      .status(409)
      .json({ message: "Ticket changed. Refresh and retry" });
  const result = await prisma.ticket.findFirst({
    where: { id: ticket.id },
    include,
  });
  res.json({ ...sanitize(result, user), slaMissed: missed(result, now) });
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
