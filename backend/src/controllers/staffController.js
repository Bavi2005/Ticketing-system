const bcrypt = require("bcryptjs");
const prisma = require("../utils/prisma");
const { zones, zoneOf, fail, siteScope, siteIdsOf } = require("../utils/ticketing");
const { parseStaffCsv } = require("../utils/staffCsv");
const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  accessEnabled: true,
  zone: true,
  branchId: true,
  siteIds: true,
  regionAccess: true,
  allSites: true,
  operatorId: true,
  branch: true,
};
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};
// Keep deletion failures actionable without exposing database internals.
async function deletionTransaction(fn) {
  try {
    return await prisma.$transaction(fn, { maxWait: 10000, timeout: 30000 });
  } catch (error) {
    if (["P2003", "P2011"].includes(error.code)) {
      throw Object.assign(new Error("Deletion blocked by database relationships. No users were deleted. The database administrator should verify the user-deletion history upgrade (20261013_user_deletion_history.sql) has been applied."), { status: 409 });
    }
    if (["P2028", "P2034"].includes(error.code)) {
      throw Object.assign(new Error("Deletion timed out or conflicted with another change. No users were deleted. Please retry, or select fewer users."), { status: 409 });
    }
    throw error;
  }
}
function requireOperator(user) {
  if (user.role !== "OPERATOR")
    throw Object.assign(new Error("Credential management is restricted to the operator account"), { status: 403 });
}
function staffScope(user) {
  if (user.role === "OPERATOR") return { role: { in: ["STAFF", "BRANCH_MANAGER", "HQ_ADMIN"] } };
  if (user.role === "HQ_ADMIN") return { role: { in: ["STAFF", "BRANCH_MANAGER"] } };
  if (user.role === "BRANCH_MANAGER") return { role: "STAFF", OR: [{ branch: siteScope(user) }, { siteIds: { hasSome: siteIdsOf(user) } }, { allSites: true }] };
  throw Object.assign(new Error("Access control requires an operator, HQ or site manager account"), { status: 403 });
}
function validateIdentity(row, passwordRequired = true) {
  const name = String(row.name || "").trim();
  const email = String(row.email || "")
    .trim()
    .toLowerCase();
  if (name.length < 2 || name.length > 120)
    fail("Name must contain 2–120 characters");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail("Invalid email");
  if (
    passwordRequired &&
    (typeof row.password !== "string" ||
      row.password.length < 12 ||
      Buffer.byteLength(row.password, "utf8") > 72)
  )
    fail(
      "Password must have at least 12 characters and at most 72 UTF-8 bytes",
    );
  return { name, email };
}
async function validateStaff(row, actor, branches, editing = false) {
  staffScope(actor);
  const identity = validateIdentity(row, !editing);
  const inputRole = String(row.role || "STAFF")
    .trim()
    .toUpperCase();
  const role = { SU: "STAFF", SM: "BRANCH_MANAGER", HQ: "HQ_ADMIN" }[inputRole] || inputRole;
  if (!["STAFF", "BRANCH_MANAGER", "HQ_ADMIN"].includes(role))
    fail("Role must be STAFF, BRANCH_MANAGER or HQ_ADMIN");
  if (actor.role === "HQ_ADMIN" && role === "HQ_ADMIN")
    throw Object.assign(new Error("HQ can assign technician or site manager access only"), { status: 403 });
  if (actor.role === "BRANCH_MANAGER" && role !== "STAFF")
    throw Object.assign(new Error("Site managers can assign technician access only"), { status: 403 });
  const operatorId = actor.role === "OPERATOR" ? actor.ownedOperator?.id : actor.operatorId;
  if (actor.role === "OPERATOR" && !operatorId) fail("Operator account is not configured");
  if (role === "HQ_ADMIN")
    return { ...identity, role, branchId: null, zone: null, siteIds: [], regionAccess: [], allSites: false, operatorId };
  const access = validateAccess(row, role, branches);
  return { ...identity, role, ...access, operatorId: operatorId || null };
}
function validateAccess(row, role, branches) {
  if (row.allSites !== undefined && typeof row.allSites !== "boolean") fail("All sites must be enabled or disabled");
  const allSites = row.allSites === true || String(row.site_code || row.branch_code || "").trim() === "*";
  if (allSites && role !== "STAFF") fail("All sites is available for technicians only; select manager regions");
  let selected;
  if (row.siteIds !== undefined) {
    if (!Array.isArray(row.siteIds) || row.siteIds.some(id => typeof id !== "string")) fail("Choose valid sites");
    selected = [...new Set(row.siteIds)].map(id => branches.find(b => b.id === id));
  } else {
    const codes = String(row.site_code || row.branch_code || "").split(";").map(v => v.trim()).filter(v => v && v !== "*");
    selected = codes.map(code => branches.find(b => b.code === code));
  }
  if (selected.some(site => !site)) fail("Unknown site code");
  const requestedRegions = row.regionAccess === undefined
    ? String(row.region || row.zone || "").split(";").map(v => v.trim()).filter(Boolean)
    : row.regionAccess;
  if (!Array.isArray(requestedRegions) || requestedRegions.some(region => !zones.includes(region))) fail("Invalid region");
  if (!allSites && !selected.length && !(role === "BRANCH_MANAGER" && requestedRegions.length)) fail("Choose at least one site or manager region");
  if (row.siteIds === undefined && selected.length === 1 && requestedRegions.length === 1 && requestedRegions[0] !== zoneOf(selected[0])) fail("Region must match the site");
  const regionAccess = role === "BRANCH_MANAGER" ? [...new Set([...requestedRegions, ...selected.map(zoneOf)])] : [];
  return { siteIds: allSites ? [] : selected.map(b => b.id), regionAccess, allSites,
    branchId: allSites ? null : selected[0]?.id || null,
    zone: allSites ? null : selected[0]?.zone || regionAccess[0] || null };

}
exports.list = handle(async (req, res) => {
  res.json(
    await prisma.user.findMany({
      where: staffScope(req.user),
      select,
      orderBy: { name: "asc" },
    }),
  );
});
exports.create = handle(async (req, res) => {
  staffScope(req.user);
  const branches = await prisma.branch.findMany();
  const data = await validateStaff(req.body, req.user, branches);
  data.passwordHash = await bcrypt.hash(req.body.password, 12);
  res.status(201).json(await prisma.user.create({ data, select }));
});
exports.update = handle(async (req, res) => {
  staffScope(req.user);
  if (req.params.id === req.user.id)
    return res
      .status(403)
      .json({
        message:
          "Use Profile to edit your account; self role changes are prohibited",
      });
  const target = await prisma.user.findFirst({
    where: { id: req.params.id, ...staffScope(req.user) },
  });
  if (!target)
    return res.status(404).json({ message: "Staff member not found" });
  if (!["STAFF", "BRANCH_MANAGER", "HQ_ADMIN"].includes(target.role))
    fail("This credential cannot be managed here");
  const branches = await prisma.branch.findMany();
  const oldBranch = branches.find((b) => b.id === target.branchId);
  const row = {
    name: target.name,
    email: target.email,
    role: target.role,
    branch_code: oldBranch?.code,
    zone: target.zone || (oldBranch && zoneOf(oldBranch)),
    ...(req.body.site_code === undefined && req.body.branch_code === undefined ? { siteIds: target.siteIds?.length ? target.siteIds : target.branchId ? [target.branchId] : [], regionAccess: target.regionAccess || [], allSites: target.allSites || false } : {}),
    ...req.body,
  };
  const data = await validateStaff(row, req.user, branches, true);
  if (req.body.accessEnabled !== undefined) {
    if (typeof req.body.accessEnabled !== "boolean") fail("Access must be enabled or disabled");
    data.accessEnabled = req.body.accessEnabled;
  }
  if (req.body.password) {
    requireOperator(req.user);
    validateIdentity({ ...row, password: req.body.password });
    data.passwordHash = await bcrypt.hash(req.body.password, 12);
  }
  // Preserve ownership while changing role or branch access.
  data.operatorId = target.operatorId;
  const updated = await prisma.user.updateMany({
    where: { id: target.id, ...staffScope(req.user) },
    data,
  });
  if (!updated.count)
    return res
      .status(409)
      .json({ message: "Staff scope changed. Refresh and retry" });
  res.json(await prisma.user.findUnique({ where: { id: target.id }, select }));
});
exports.importCsv = handle(async (req, res) => {
  staffScope(req.user);
  const rows = parseStaffCsv(req.body.csv);
  const branches = await prisma.branch.findMany();
  const emails = new Set();
  const errors = [],
    valid = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      const data = await validateStaff(rows[i], req.user, branches);
      if (emails.has(data.email)) fail("Duplicate email in CSV");
      emails.add(data.email);
      valid.push({ data, password: rows[i].password, row: i + 2 });
    } catch (e) {
      errors.push({ row: i + 2, message: e.message });
    }
  }
  const existing = await prisma.user.findMany({
    where: { email: { in: [...emails] } },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((u) => u.email));
  for (const v of valid)
    if (existingEmails.has(v.data.email))
      errors.push({ row: v.row, message: "Email already exists" });
  if (errors.length)
    return res
      .status(400)
      .json({ message: "Fix the CSV errors; no credentials were added", errors });
  if (req.body.preview === true)
    return res.json({
      count: valid.length,
      staff: valid.map((v) => ({ ...v.data, row: v.row })),
    });
  const data = [];
  for (const v of valid)
    data.push({ ...v.data, passwordHash: await bcrypt.hash(v.password, 12) });
  // A duplicate introduced after validation aborts the entire statement/transaction.
  const result = await prisma.$transaction(
    (tx) => tx.user.createMany({ data }),
    { timeout: 30000 },
  );
  res
    .status(201)
    .json({
      count: result.count,
      message: `${result.count} credentials created`,
    });
});
module.exports.staffScope = staffScope;

exports.technicians = handle(async (req, res) => {
  if (req.user.role !== "BRANCH_MANAGER" || (!req.user.branchId && !req.user.regionAccess?.length && !req.user.siteIds?.length))
    return res.status(403).json({ message: "A configured site manager is required" });
  res.json(await prisma.user.findMany({ where: { role: "STAFF" }, select, orderBy: { name: "asc" } }));
});
exports.assignTechnician = handle(async (req, res) => {
  if (req.user.role !== "BRANCH_MANAGER" || (!req.user.branchId && !req.user.regionAccess?.length && !req.user.siteIds?.length))
    return res.status(403).json({ message: "A configured site manager is required" });
  const branches = await prisma.branch.findMany();
  const access = validateAccess({ ...req.body, siteIds: req.body.siteIds ?? (req.body.branchId ? [req.body.branchId] : []) }, "STAFF", branches);
  if (typeof req.body.technicianId !== "string") fail("Choose an existing technician");
  const target = await prisma.user.findFirst({ where: { id: req.body.technicianId, role: "STAFF" } });
  if (!target) return res.status(404).json({ message: "Technician not found" });
  const result = await prisma.user.updateMany({ where: { id: target.id, role: "STAFF", branchId: target.branchId }, data: access });
  if (!result.count) return res.status(409).json({ message: "Assignment changed. Refresh and retry" });
  res.json(await prisma.user.findUnique({ where: { id: target.id }, select }));
});

exports.remove = handle(async (req, res) => {
  requireOperator(req.user);
  if (req.params.id === req.user.id) return res.status(403).json({ message: "You cannot delete your own operator account" });
  if (req.body?.confirmation !== "DELETE USER") fail("Type DELETE USER to confirm");
  await deletionTransaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw Object.assign(new Error("User not found"), { status: 404 });
    if (target.role === "OPERATOR") throw Object.assign(new Error("Operator accounts cannot be deleted here"), { status: 403 });
    await tx.ticket.updateMany({ where: { assigneeId: target.id }, data: { assigneeId: null, escalatedAt: null } });
    // Nullable relations retain ticket and comment history after account deletion.
    await tx.user.delete({ where: { id: target.id } });
  });
  res.json({ message: "User deleted. Ticket and comment history retained." });
});

exports.removeMany = handle(async (req, res) => {
  requireOperator(req.user);
  if (req.body?.confirmation !== "DELETE USERS") fail("Type DELETE USERS to confirm");
  const ids = req.body.userIds;
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string" || !id.trim()))
    fail("Select at least one user to delete");
  const userIds = [...new Set(ids)];
  if (userIds.includes(req.user.id))
    return res.status(403).json({ message: "You cannot delete your own operator account" });
  const count = await deletionTransaction(async (tx) => {
    const targets = await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } });
    if (targets.some((target) => target.role === "OPERATOR"))
      throw Object.assign(new Error("Operator accounts cannot be deleted here"), { status: 403 });
    if (targets.length !== userIds.length)
      throw Object.assign(new Error("Some selected users no longer exist. Refresh the list and retry; no users were deleted."), { status: 409 });
    await tx.ticket.updateMany({ where: { assigneeId: { in: userIds } }, data: { assigneeId: null, escalatedAt: null } });
    // Existing nullable relations retain ticket and comment authorship history.
    // Recheck role at deletion time; a concurrent promotion rolls back the entire batch.
    const result = await tx.user.deleteMany({ where: { id: { in: userIds }, role: { not: "OPERATOR" } } });
    if (result.count !== userIds.length)
      throw Object.assign(new Error("Selected accounts changed. Refresh and retry; no users were deleted."), { status: 409 });
    return result.count;
  });
  res.json({ count, message: `${count} user${count === 1 ? "" : "s"} deleted. Ticket and comment history retained.` });
});
