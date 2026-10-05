const bcrypt = require("bcryptjs");
const prisma = require("../utils/prisma");
const { zones, zoneOf, fail } = require("../utils/ticketing");
const { parseStaffCsv } = require("../utils/staffCsv");
const select = {
  id: true,
  name: true,
  email: true,
  role: true,
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
function staffScope(user) {
  if (user.role === "HQ_ADMIN") return {};
  if (user.role === "OPERATOR")
    return {
      operatorId: user.ownedOperator?.id || "__NO_OPERATOR__",
      role: { in: ["STAFF", "BRANCH_MANAGER"] },
    };
  if (user.role === "BRANCH_MANAGER")
    return {
      role: { in: ["STAFF", "BRANCH_MANAGER"] },
      branch: {
        zone:
          user.zone || (user.branch && zoneOf(user.branch)) || "__NO_ZONE__",
      },
      ...(user.operatorId ? { operatorId: user.operatorId } : {}),
    };
  return { id: "__NO_ACCESS__" };
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
async function validateStaff(row, actor, branches) {
  const identity = validateIdentity(row);
  const inputRole = String(row.role || "STAFF")
    .trim()
    .toUpperCase();
  const role = { SU: "STAFF", SM: "BRANCH_MANAGER" }[inputRole] || inputRole;
  if (!["STAFF", "BRANCH_MANAGER"].includes(role))
    fail("Staff role must be STAFF or BRANCH_MANAGER");
  const branch = branches.find(
    (b) => b.code === String(row.branch_code || "").trim(),
  );
  if (!branch) fail("Unknown branch_code");
  const zone = String(row.zone || zoneOf(branch)).trim();
  if (!zones.includes(zone) || zone !== zoneOf(branch))
    fail("Zone must match the branch");
  if (
    actor.role === "BRANCH_MANAGER" &&
    zone !== (actor.zone || zoneOf(actor.branch))
  )
    fail("Branch is outside your assigned zone");
  const operatorId =
    actor.role === "OPERATOR" ? actor.ownedOperator?.id : actor.operatorId;
  if (actor.role === "OPERATOR" && !operatorId)
    fail("Operator account is not configured");
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
  const branches = await prisma.branch.findMany();
  const data = await validateStaff(req.body, req.user, branches);
  if (req.user.role === "HQ_ADMIN" && req.body.operatorId) {
    const operator = await prisma.operator.findUnique({
      where: { id: req.body.operatorId },
    });
    if (!operator) fail("Unknown operator");
    data.operatorId = operator.id;
  }
  data.passwordHash = await bcrypt.hash(req.body.password, 12);
  res.status(201).json(await prisma.user.create({ data, select }));
});
exports.update = handle(async (req, res) => {
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
  if (!["STAFF", "BRANCH_MANAGER"].includes(target.role))
    fail("Operator and HQ roles are managed separately");
  const branches = await prisma.branch.findMany();
  const oldBranch = branches.find((b) => b.id === target.branchId);
  const row = {
    name: target.name,
    email: target.email,
    role: target.role,
    branch_code: oldBranch?.code,
    zone: target.zone || (oldBranch && zoneOf(oldBranch)),
    ...req.body,
    password: "validation-placeholder",
  };
  const data = await validateStaff(row, req.user, branches);
  // Keep existing ownership. A zone manager cannot transfer staff to another operator.
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
  const rows = parseStaffCsv(req.body.csv);
  let importOperatorId;
  if (req.user.role === "HQ_ADMIN" && req.body.operatorId) {
    const operator = await prisma.operator.findUnique({
      where: { id: req.body.operatorId },
    });
    if (!operator) fail("Unknown operator");
    importOperatorId = operator.id;
  }
  const branches = await prisma.branch.findMany();
  const emails = new Set();
  const errors = [],
    valid = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      const data = await validateStaff(rows[i], req.user, branches);
      if (importOperatorId) data.operatorId = importOperatorId;
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
      .json({ message: "Fix the CSV errors; no staff were added", errors });
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
      message: `${result.count} staff accounts created`,
    });
});
exports.operators = handle(async (req, res) => {
  res.json(
    await prisma.operator.findMany({
      select: {
        id: true,
        name: true,
        user: { select },
        _count: { select: { staff: true } },
      },
      orderBy: { name: "asc" },
    }),
  );
});
exports.createOperator = handle(async (req, res) => {
  const identity = validateIdentity(req.body);
  const operatorName = String(req.body.operatorName || "").trim();
  if (operatorName.length < 2 || operatorName.length > 120)
    fail("Operator name must contain 2–120 characters");
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const operator = await prisma.operator.create({
    data: {
      name: operatorName,
      user: { create: { ...identity, passwordHash, role: "OPERATOR" } },
    },
    select: { id: true, name: true, user: { select } },
  });
  res.status(201).json(operator);
});
module.exports.staffScope = staffScope;
