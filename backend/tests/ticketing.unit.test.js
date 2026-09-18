const express = require("express");
const request = require("supertest");
jest.mock("../src/utils/prisma", () => ({
  ticket: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  branch: { findMany: jest.fn(), findUnique: jest.fn() },
  user: { findFirst: jest.fn() },
  ticketComment: { create: jest.fn() },
}));
const prisma = require("../src/utils/prisma");
const controller = require("../src/controllers/ticketController");
const { scope, filters, missed } = require("../src/utils/ticketing");
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = {
    id: "alice",
    role: req.headers["x-role"] || "STAFF",
    branchId: "pahang",
  };
  next();
});
app.get("/dashboard", controller.dashboard);
app.get("/tickets", controller.list);
app.post("/tickets", controller.create);
app.patch("/tickets/:id", controller.update);
app.post("/tickets/:id/comments", controller.comment);
app.get("/metadata", controller.metadata);
app.use((e, req, res, next) =>
  res.status(e.status || 500).json({ message: e.message }),
);
const ticket = {
  id: "t1",
  title: "Cooling failure",
  branchId: "pahang",
  branch: { id: "pahang", name: "Pahang" },
  category: "HVAC",
  status: "NEW",
  resolutionDueAt: new Date("2026-09-10T12:00:00Z"),
  createdAt: new Date("2026-09-09T20:00:00Z"),
  comments: [
    { id: "private", internal: true },
    { id: "public", internal: false },
  ],
};
beforeEach(() => {
  jest.resetAllMocks();
  prisma.ticket.findMany.mockResolvedValue([ticket]);
  prisma.branch.findMany.mockResolvedValue([]);
});
test("staff and managers share branch scope, HQ has company scope, missing branch fails closed", () => {
  expect(scope({ role: "STAFF", branchId: "pahang", id: "alice" })).toEqual({
    branchId: "pahang",
  });
  expect(scope({ role: "BRANCH_MANAGER", branchId: "pahang" })).toEqual({
    branchId: "pahang",
  });
  expect(scope({ role: "HQ_ADMIN" })).toEqual({});
  expect(scope({ role: "STAFF" }).branchId).toBe("__NO_BRANCH__");
});
test("list and dashboard cannot override branch scope through a query", async () => {
  for (const path of ["/tickets", "/dashboard"]) {
    expect((await request(app).get(`${path}?branchId=sabah`)).status).toBe(200);
    expect(prisma.ticket.findMany.mock.lastCall[0].where).toEqual({
      branchId: "pahang",
      AND: [{ branchId: "sabah" }],
    });
  }
});
test("staff never receive internal comments or other requesters email addresses", async () => {
  const r = await request(app).get("/tickets");
  expect(r.body[0].comments).toEqual([{ id: "public", internal: false }]);
  expect(
    prisma.ticket.findMany.mock.lastCall[0].include.requester.select.email,
  ).toBeUndefined();
});
test("completed tickets resolved after their deadline still count as missed SLA", () => {
  expect(
    missed({
      ...ticket,
      status: "RESOLVED",
      resolvedAt: new Date("2026-09-10T13:00:00Z"),
    }),
  ).toBe(true);
  expect(
    missed({
      ...ticket,
      status: "CLOSED",
      resolvedAt: new Date("2026-09-10T12:00:00Z"),
    }),
  ).toBe(false);
});
test("Malaysia date range includes the entire end date, rejects invalid dates and inverted ranges", () => {
  const where = filters(
    { from: "2026-09-01", to: "2026-09-30" },
    { role: "HQ_ADMIN" },
  );
  expect(where.createdAt.gte.toISOString()).toBe("2026-08-31T16:00:00.000Z");
  expect(where.createdAt.lt.toISOString()).toBe("2026-09-30T16:00:00.000Z");
  expect(() => filters({ from: "2026-02-30" }, {})).toThrow("Invalid date");
  expect(() => filters({ from: "2026-09-30", to: "2026-09-01" }, {})).toThrow(
    "Start date",
  );
});
test("all five totals, category drilldowns and graph outcomes reconcile", async () => {
  prisma.ticket.findMany.mockResolvedValue([
    ticket,
    {
      ...ticket,
      id: "t2",
      status: "RESOLVED",
      resolvedAt: new Date("2026-09-10T11:00:00Z"),
    },
  ]);
  const r = await request(app).get("/dashboard?metric=resolved");
  expect(r.body).toMatchObject({
    total: 2,
    unresolved: 1,
    resolved: 1,
    missed: 1,
    within: 1,
  });
  expect(r.body.categories[0]).toEqual({ name: "HVAC", count: 1 });
  expect(r.body.trend).toEqual([
    { date: "2026-09-10", resolved: 1, unresolved: 1 },
  ]);
});
test("staff can submit to another branch, with zone enforced and requester fixed to session", async () => {
  prisma.branch.findUnique.mockResolvedValue({ id: "sabah", name: "Sabah" });
  prisma.ticket.create.mockResolvedValue({ ...ticket, branchId: "sabah" });
  const payload = {
    title: "Camera offline",
    description: "Loading bay",
    category: "CCTV",
    priority: "HIGH",
    branchId: "sabah",
    zone: "East MY",
    requesterId: "someone-else",
  };
  expect((await request(app).post("/tickets").send(payload)).status).toBe(201);
  expect(prisma.ticket.create.mock.lastCall[0].data).toMatchObject({
    branchId: "sabah",
    requesterId: "alice",
  });
  expect(
    (
      await request(app)
        .post("/tickets")
        .send({ ...payload, zone: "West MY" })
    ).status,
  ).toBe(400);
});
test("invalid category and prototype priority values cannot create tickets", async () => {
  for (const payload of [
    { category: "Electrical" },
    { priority: "constructor" },
  ]) {
    expect(
      (
        await request(app)
          .post("/tickets")
          .send({
            title: "Test",
            description: "Test",
            category: "HVAC",
            priority: "HIGH",
            zone: "West MY",
            ...payload,
          })
      ).status,
    ).toBe(400);
  }
  expect(prisma.ticket.create).not.toHaveBeenCalled();
});
test("out-of-scope IDs cannot be updated or commented on", async () => {
  prisma.ticket.findFirst.mockResolvedValue(null);
  expect(
    (await request(app).patch("/tickets/other").send({ status: "CLOSED" }))
      .status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post("/tickets/other/comments")
        .send({ message: "Leak" })
    ).status,
  ).toBe(404);
  expect(prisma.ticket.findFirst.mock.lastCall[0].where).toEqual({
    id: "other",
    branchId: "pahang",
  });
  expect(prisma.ticket.update).not.toHaveBeenCalled();
  expect(prisma.ticketComment.create).not.toHaveBeenCalled();
});
test("staff cannot change workflow or post internal notes", async () => {
  prisma.ticket.findFirst.mockResolvedValue(ticket);
  prisma.ticketComment.create.mockResolvedValue({});
  expect(
    (await request(app).patch("/tickets/t1").send({ status: "RESOLVED" }))
      .status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post("/tickets/t1/comments")
        .send({ message: "Update", internal: true })
    ).status,
  ).toBe(201);
  expect(prisma.ticketComment.create.mock.lastCall[0].data.internal).toBe(
    false,
  );
});
test("reopening clears completion timestamps and reassignment cannot cross branch boundaries", async () => {
  prisma.ticket.findFirst.mockResolvedValue({
    ...ticket,
    status: "CLOSED",
    resolvedAt: new Date(),
    closedAt: new Date(),
  });
  prisma.ticket.update.mockResolvedValue(ticket);
  expect(
    (
      await request(app)
        .patch("/tickets/t1")
        .set("x-role", "BRANCH_MANAGER")
        .send({ status: "IN_PROGRESS" })
    ).status,
  ).toBe(200);
  expect(prisma.ticket.update.mock.lastCall[0].data).toMatchObject({
    resolvedAt: null,
    closedAt: null,
  });
  prisma.user.findFirst.mockResolvedValue(null);
  expect(
    (
      await request(app)
        .patch("/tickets/t1")
        .set("x-role", "BRANCH_MANAGER")
        .send({ assigneeId: "other-branch" })
    ).status,
  ).toBe(400);
});
test("HQ reads all branches and receives internal notes", async () => {
  const r = await request(app).get("/tickets").set("x-role", "HQ_ADMIN");
  expect(r.body[0].comments).toHaveLength(2);
  expect(prisma.ticket.findMany.mock.lastCall[0].where).toEqual({});
});
