const categories = [
  "HVAC",
  "CCTV",
  "Fire Alarm",
  "BAS",
  "Gas System",
  "Elevator",
];
const zones = ["West MY", "East MY"];
const statuses = [
  "NEW",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
];
const sla = { CRITICAL: [1, 4], HIGH: [4, 12], MEDIUM: [8, 24], LOW: [24, 72] };
const zoneOf = (branch) =>
  /sabah|sarawak|labuan/i.test(`${branch.name} ${branch.location || ""}`)
    ? "East MY"
    : "West MY";
const completed = (t) => ["RESOLVED", "CLOSED"].includes(t.status);
const missed = (t, now = new Date()) =>
  new Date(completed(t) ? t.resolvedAt || t.closedAt || t.updatedAt : now) >
  new Date(t.resolutionDueAt);
const scope = (user) =>
  user.role === "HQ_ADMIN"
    ? {}
    : user.role === "STAFF"
      ? { requesterId: user.id || "__NO_USER__" }
      : user.role === "BRANCH_MANAGER"
        ? { branchId: user.branchId || "__NO_BRANCH__" }
        : { id: "__NO_ACCESS__" };
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};
function filters(query, user) {
  const where = scope(user);
  if (query.branchId) where.AND = [{ branchId: query.branchId }];
  if (query.status) {
    if (!statuses.includes(query.status)) fail("Invalid status");
    where.status = query.status;
  }
  if (query.priority) {
    if (!Object.hasOwn(sla, query.priority)) fail("Invalid priority");
    where.priority = query.priority;
  }
  if (query.category) {
    if (!categories.includes(query.category)) fail("Invalid service category");
    where.category = query.category;
  }
  if (query.zone && !zones.includes(query.zone)) fail("Invalid zone");
  if (
    query.metric &&
    !["total", "unresolved", "resolved", "missed", "within"].includes(
      query.metric,
    )
  )
    fail("Invalid metric");
  for (const key of ["from", "to"])
    if (query[key]) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(query[key]) ||
        !Number.isFinite(Date.parse(query[key])) ||
        new Date(query[key]).toISOString().slice(0, 10) !== query[key]
      )
        fail("Invalid date range");
    }
  if (query.from && query.to && query.from > query.to)
    fail("Start date must precede end date");
  if (query.from || query.to)
    where.createdAt = {
      ...(query.from ? { gte: new Date(`${query.from}T00:00:00+08:00`) } : {}),
      ...(query.to
        ? {
            lt: new Date(
              new Date(`${query.to}T00:00:00+08:00`).getTime() + 86400000,
            ),
          }
        : {}),
    };
  return where;
}
function matches(t, query, now) {
  if (query.zone && zoneOf(t.branch) !== query.zone) return false;
  return (
    !query.metric ||
    query.metric === "total" ||
    {
      unresolved: !completed(t),
      resolved: completed(t),
      missed: missed(t, now),
      within: !missed(t, now),
    }[query.metric]
  );
}
module.exports = {
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
};
