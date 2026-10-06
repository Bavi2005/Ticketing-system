const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
jest.mock("../src/utils/prisma", () => ({
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  operator: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  branch: { findMany: jest.fn() },
  $transaction: jest.fn(),
}));
const prisma = require("../src/utils/prisma");
const c = require("../src/controllers/staffController");
const { parseStaffCsv } = require("../src/utils/staffCsv");
const { scope } = require("../src/utils/ticketing");
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = {
    id: "actor",
    role: req.headers["x-role"] || "OPERATOR",
    ownedOperator: { id: "op1" },
    zone: "West MY",
    branch: { name: "Pahang", zone: "West MY" },
  };
  next();
});
app.post("/import", c.importCsv);
app.post("/staff", c.create);
app.patch("/staff/:id", c.update);
app.get("/staff", c.list);
app.use((e, req, res, next) =>
  res
    .status(e.status || (e.code === "P2002" ? 409 : 500))
    .json({ message: e.message }),
);
const row = "Alice,alice@example.com,A-unique-password,SU,BR1,West MY";
const csv = `name,email,password,role,branch_code,zone\r\n${row}\r\n`;
beforeEach(() => {
  jest.resetAllMocks();
  prisma.branch.findMany.mockResolvedValue([
    { id: "br1", code: "BR1", name: "Pahang", zone: "West MY" },
    { id: "br2", code: "BR2", name: "Sabah", zone: "East MY" },
  ]);
  prisma.user.findMany.mockResolvedValue([]);
  prisma.user.createMany.mockResolvedValue({ count: 1 });
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
});
test("CSV handles BOM, quoted commas, escaped quotes, newlines and CRLF", () => {
  const input =
    '\uFEFFname,email,password,role,branch_code\r\n"Alice, ""A""\nB",a@example.com,123456789012,STAFF,BR1\r\n';
  expect(parseStaffCsv(input)[0].name).toBe('Alice, "A"\nB');
});
test("malformed CSV, duplicate headers, missing columns, and oversized imports are rejected", () => {
  for (const input of [
    "name,name\nA,B",
    "name,email\nA,B",
    csv + '"unfinished',
    csv + "A,B",
    "x".repeat(512001),
    csv + `${row}\n`.repeat(500),
  ])
    expect(() => parseStaffCsv(input)).toThrow();
});
test("preview exposes no passwords and operator scope is fixed by session", async () => {
  const r = await request(app)
    .post("/import")
    .send({ csv, preview: true, operatorId: "other" });
  expect(r.status).toBe(200);
  expect(r.body.count).toBe(1);
  expect(r.body.staff[0]).toMatchObject({ operatorId: "op1", role: "STAFF" });
  expect(JSON.stringify(r.body)).not.toContain("A-unique-password");
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("valid import hashes passwords and adds all rows in a transaction", async () => {
  const r = await request(app).post("/import").send({ csv });
  expect(r.status).toBe(201);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  const data = prisma.user.createMany.mock.lastCall[0].data[0];
  expect(data.password).toBeUndefined();
  expect(await bcrypt.compare("A-unique-password", data.passwordHash)).toBe(
    true,
  );
  expect(data.operatorId).toBe("op1");
});
test("invalid rows, duplicate emails and existing accounts result in zero writes", async () => {
  for (const input of [
    csv + row,
    csv.replace("SU", "UNKNOWN_ROLE"),
    csv.replace("BR1", "BOGUS"),
    csv.replace("West MY", "East MY"),
    csv.replace("A-unique-password", "short"),
  ]) {
    const r = await request(app).post("/import").send({ csv: input });
    expect(r.status).toBe(400);
    expect(r.body.errors.length).toBeGreaterThan(0);
  }
  prisma.user.findMany.mockResolvedValue([{ email: "alice@example.com" }]);
  expect((await request(app).post("/import").send({ csv })).status).toBe(400);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("only operators can administer credentials, including direct controller access", async () => {
  for (const role of ["HQ_ADMIN", "BRANCH_MANAGER", "STAFF"]) {
    expect((await request(app).get("/staff").set("x-role", role)).status).toBe(403);
    expect((await request(app).post("/staff").set("x-role", role).send({})).status).toBe(403);
    expect((await request(app).patch("/staff/other").set("x-role", role).send({})).status).toBe(403);
    expect((await request(app).post("/import").set("x-role", role).send({ csv })).status).toBe(403);
  }
  expect(prisma.user.create).not.toHaveBeenCalled();
  expect(prisma.user.updateMany).not.toHaveBeenCalled();
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("operator has platform-wide oversight including legacy accounts and tickets", async () => {
  await request(app).get("/staff?operatorId=other");
  expect(prisma.user.findMany.mock.lastCall[0].where).toEqual({ role: { in: ["STAFF", "BRANCH_MANAGER", "HQ_ADMIN"] } });
  expect(scope({ role: "OPERATOR", id: "actor" })).toEqual({});
});
test("out of scope edits and self promotion are rejected before writing", async () => {
  prisma.user.findFirst.mockResolvedValue(null);
  expect(
    (await request(app).patch("/staff/other").send({ role: "HQ_ADMIN" }))
      .status,
  ).toBe(404);
  expect(
    (await request(app).patch("/staff/actor").send({ role: "HQ_ADMIN" }))
      .status,
  ).toBe(403);
  expect(prisma.user.updateMany).not.toHaveBeenCalled();
});
test("operator creates HQ credentials without a branch and excludes password hashes", async () => {
  prisma.user.create.mockResolvedValue({ id: "hq2", email: "hq@example.com", role: "HQ_ADMIN" });
  const r = await request(app).post("/staff").send({ name: "HQ Lead", email: "HQ@example.com", password: "Unique-hq-password", role: "HQ", operatorId: "other" });
  expect(r.status).toBe(201);
  const args = prisma.user.create.mock.lastCall[0];
  expect(args.data).toMatchObject({ role: "HQ_ADMIN", operatorId: "op1", branchId: null, zone: null });
  expect(args.select.passwordHash).toBeUndefined();
  expect(await bcrypt.compare("Unique-hq-password", args.data.passwordHash)).toBe(true);
});
test("mixed HQ, manager and technician CSV imports are atomic", async () => {
  const mixed = csv + "HQ Lead,hq@example.com,Unique-hq-password,HQ,,\r\nManager,manager@example.com,Unique-sm-password,SM,BR2,East MY\r\n";
  prisma.user.createMany.mockResolvedValue({ count: 3 });
  const preview = await request(app).post("/import").send({ csv: mixed, preview: true });
  expect(preview.status).toBe(200);
  expect(preview.body.count).toBe(3);
  expect(preview.body.staff[1]).toMatchObject({ role: "HQ_ADMIN", branchId: null, zone: null });
  expect(JSON.stringify(preview.body)).not.toContain("Unique-hq-password");
  const imported = await request(app).post("/import").send({ csv: mixed });
  expect(imported.status).toBe(201);
  expect(prisma.user.createMany.mock.lastCall[0].data.map((user) => user.role)).toEqual(["STAFF", "HQ_ADMIN", "BRANCH_MANAGER"]);
});
test("operator can change legacy HQ access and keeps existing ownership", async () => {
  prisma.user.findFirst.mockResolvedValue({ id: "hq2", name: "HQ Lead", email: "hq@example.com", role: "HQ_ADMIN", branchId: null, operatorId: null });
  prisma.user.updateMany.mockResolvedValue({ count: 1 });
  prisma.user.findUnique.mockResolvedValue({ id: "hq2", role: "BRANCH_MANAGER" });
  const r = await request(app).patch("/staff/hq2").send({ role: "SM", branch_code: "BR1", zone: "West MY" });
  expect(r.status).toBe(200);
  expect(prisma.user.updateMany.mock.lastCall[0].data).toMatchObject({ role: "BRANCH_MANAGER", branchId: "br1", operatorId: null });
});
test("duplicate account race aborts import with a conflict", async () => {
  prisma.$transaction.mockRejectedValue(
    Object.assign(new Error("Email exists"), { code: "P2002" }),
  );
  expect((await request(app).post("/import").send({ csv })).status).toBe(409);
});

// Exercise the actual route guards and DB-backed auth, not only controllers.
process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET ||= "staff-route-test-secret-32";
const jwt = require("jsonwebtoken");
const routedApp = express();
routedApp.use(express.json());
routedApp.use("/staff", require("../src/routes/staffRoutes"));
routedApp.use(require("../src/middleware/errorHandler"));
const bearer = () =>
  `Bearer ${jwt.sign({ userId: "actor" }, process.env.JWT_SECRET)}`;
test("staff routes require login and reject technician staff administration", async () => {
  expect((await request(routedApp).get("/staff")).status).toBe(401);
  prisma.user.findUnique.mockResolvedValue({ id: "actor", role: "STAFF" });
  expect(
    (await request(routedApp).get("/staff").set("Authorization", bearer()))
      .status,
  ).toBe(403);
  expect(
    (
      await request(routedApp)
        .post("/staff/import")
        .set("Authorization", bearer())
        .send({ csv })
    ).status,
  ).toBe(403);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("all credential endpoints enforce the DB role, even with a forged operator JWT claim", async () => {
  const fakeOperatorToken = jwt.sign({ userId: "actor", role: "OPERATOR" }, process.env.JWT_SECRET);
  for (const role of ["HQ_ADMIN", "BRANCH_MANAGER", "STAFF"]) {
    prisma.user.findUnique.mockResolvedValue({ id: "actor", role });
    for (const [method, path] of [["get", "/staff"], ["post", "/staff"], ["post", "/staff/import"], ["patch", "/staff/other"], ["post", "/staff/operators"]]) {
      expect((await request(routedApp)[method](path).set("Authorization", `Bearer ${fakeOperatorToken}`).send({})).status).toBe(403);
    }
  }
  expect(prisma.user.create).not.toHaveBeenCalled();
  expect(prisma.user.updateMany).not.toHaveBeenCalled();
  expect(prisma.$transaction).not.toHaveBeenCalled();
  prisma.user.findUnique.mockResolvedValue({ id: "actor", role: "OPERATOR", ownedOperator: { id: "op1" } });
  expect((await request(routedApp).get("/staff").set("Authorization", bearer())).status).toBe(200);
});

const loginApp = express();
loginApp.use(express.json());
loginApp.post("/login", require("../src/controllers/authController").login);
loginApp.use(require("../src/middleware/errorHandler"));
test("system-control login accepts only a dedicated operator account", async () => {
  const passwordHash = await bcrypt.hash("Unique-login-password", 12);
  prisma.user.findUnique.mockResolvedValue({ id: "actor", role: "HQ_ADMIN", passwordHash });
  expect((await request(loginApp).post("/login").send({ email: "hq@example.com", password: "Unique-login-password", portal: "operator" })).status).toBe(403);
  prisma.user.findUnique.mockResolvedValue({ id: "actor", role: "OPERATOR", passwordHash });
  const operator = await request(loginApp).post("/login").send({ email: "op@example.com", password: "Unique-login-password", portal: "operator" });
  expect(operator.status).toBe(200);
  expect(operator.body.user.role).toBe("OPERATOR");
  expect(operator.body.user.passwordHash).toBeUndefined();
  expect((await request(loginApp).post("/login").send({ email: "op@example.com", password: "Unique-login-password", portal: "operations" })).status).toBe(403);
});
