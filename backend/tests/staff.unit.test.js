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
app.post("/operator", c.createOperator);
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
    csv.replace("SU", "HQ_ADMIN"),
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
test("manager cannot import staff from another zone or assign HQ roles", async () => {
  expect(
    (
      await request(app)
        .post("/import")
        .set("x-role", "BRANCH_MANAGER")
        .send({ csv: csv.replace("BR1", "BR2").replace("West MY", "East MY") })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app).post("/staff").set("x-role", "BRANCH_MANAGER").send({
        name: "Alice",
        email: "alice@example.com",
        password: "A-unique-password",
        role: "HQ_ADMIN",
        branch_code: "BR1",
      })
    ).status,
  ).toBe(400);
  expect(prisma.user.create).not.toHaveBeenCalled();
});
test("operator and manager directory scopes cannot be overwritten", async () => {
  await request(app).get("/staff?operatorId=other");
  expect(prisma.user.findMany.mock.lastCall[0].where.operatorId).toBe("op1");
  await request(app).get("/staff").set("x-role", "BRANCH_MANAGER");
  expect(prisma.user.findMany.mock.lastCall[0].where.branch).toEqual({
    zone: "West MY",
  });
  expect(
    scope({ role: "OPERATOR", id: "actor", ownedOperator: { id: "op1" } }),
  ).toEqual({
    OR: [{ requester: { operatorId: "op1" } }, { requesterId: "actor" }],
  });
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
test("operator credential creation never returns password hashes", async () => {
  prisma.operator.create.mockResolvedValue({
    id: "op2",
    name: "Operator B",
    user: { email: "op@example.com" },
  });
  const r = await request(app)
    .post("/operator")
    .set("x-role", "HQ_ADMIN")
    .send({
      operatorName: "Operator B",
      name: "Op User",
      email: "OP@example.com",
      password: "Unique-operator-password",
    });
  expect(r.status).toBe(201);
  const args = prisma.operator.create.mock.lastCall[0];
  expect(args.data.user.create.role).toBe("OPERATOR");
  expect(args.select.user.select.passwordHash).toBeUndefined();
  expect(
    await bcrypt.compare(
      "Unique-operator-password",
      args.data.user.create.passwordHash,
    ),
  ).toBe(true);
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
test("only HQ can create operators; role is loaded from the DB, not JWT claims", async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: "actor",
    role: "OPERATOR",
    ownedOperator: { id: "op1" },
  });
  const fakeHqToken = jwt.sign(
    { userId: "actor", role: "HQ_ADMIN" },
    process.env.JWT_SECRET,
  );
  expect(
    (
      await request(routedApp)
        .post("/staff/operators")
        .set("Authorization", `Bearer ${fakeHqToken}`)
        .send({})
    ).status,
  ).toBe(403);
  expect(prisma.operator.create).not.toHaveBeenCalled();
  expect(
    (await request(routedApp).get("/staff").set("Authorization", bearer()))
      .status,
  ).toBe(200);
});
