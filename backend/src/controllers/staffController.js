const bcrypt = require("bcryptjs");
const prisma = require("../utils/prisma");
const { zones, zoneOf, fail } = require("../utils/ticketing");
const { parseStaffCsv } = require("../utils/staffCsv");
const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  accessEnabled: true,
  zone: true,
  branchId: true,
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
function requireOperator(user) {
  if (user.role !== "OPERATOR")
    throw Object.assign(new Error("Credential management is restricted to the operator account"), { status: 403 });
}
function staffScope(user) {
  if (user.role === "OPERATOR") return { role: { in: ["STAFF", "BRANCH_MANAGER", "HQ_ADMIN"] } };
  if (user.role === "HQ_ADMIN") return { role: { in: ["STAFF", "BRANCH_MANAGER"] } };
  if (user.role === "BRANCH_MANAGER") return { role: "STAFF", branchId: user.branchId || "__NO_SITE__" };
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
  if (!editing) requireOperator(actor);
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
  const operatorId = actor.ownedOperator?.id;
  if (actor.role === "OPERATOR" && !operatorId) fail("Operator account is not configured");
  if (role === "HQ_ADMIN")
    return { ...identity, role, branchId: null, zone: null, operatorId };
  const branch = branches.find(
    (b) => b.code === String(row.site_code || row.branch_code || "").trim(),
  );
  if (!branch) fail("Unknown site code");
  const zone = String(row.region || row.zone || zoneOf(branch)).trim();
  if (!zones.includes(zone) || zone !== zoneOf(branch))
    fail("Region must match the site");
  if (actor.role === "BRANCH_MANAGER" && branch.id !== actor.branchId)
    throw Object.assign(new Error("Technicians must remain at your assigned site"), { status: 403 });
  return {
    ...identity,
    role,
    branchId: branch.id,
    zone,
    operatorId: operatorId || null,
  };
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
  requireOperator(req.user);
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
  requireOperator(req.user);
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
  if (req.user.role !== "BRANCH_MANAGER" || !req.user.branchId)
    return res.status(403).json({ message: "A configured site manager is required" });
  res.json(await prisma.user.findMany({ where: { role: "STAFF", OR: [{ branchId: null }, { branchId: { not: req.user.branchId } }] }, select, orderBy: { name: "asc" } }));
});
exports.assignTechnician = handle(async (req, res) => {
  if (req.user.role !== "BRANCH_MANAGER" || !req.user.branchId)
    return res.status(403).json({ message: "A configured site manager is required" });
  const site = await prisma.branch.findUnique({ where: { id: req.user.branchId } });
  if (!site) fail("Your site is not configured");
  if (typeof req.body.technicianId !== "string") fail("Choose an existing technician");
  const target = await prisma.user.findFirst({ where: { id: req.body.technicianId, role: "STAFF" } });
  if (!target) return res.status(404).json({ message: "Technician not found" });
  const result = await prisma.user.updateMany({ where: { id: target.id, role: "STAFF", branchId: target.branchId }, data: { branchId: site.id, zone: zoneOf(site) } });
  if (!result.count) return res.status(409).json({ message: "Assignment changed. Refresh and retry" });
  res.json(await prisma.user.findUnique({ where: { id: target.id }, select }));
});
