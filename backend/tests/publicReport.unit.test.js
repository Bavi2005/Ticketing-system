const { publicReport } = require("../src/utils/publicReport");
const { sites, regions } = require("../src/utils/sites");
const now = new Date("2026-10-06T15:00:00Z");
test("supplied site catalogue contains exactly 26 unique sites and four regions", () => {
  expect(sites).toHaveLength(26); expect(new Set(sites.map((site) => site.name)).size).toBe(26);
  expect(regions).toEqual(["CENTRAL", "NORTHERN", "SOUTHERN", "EC"]);
  expect(sites[0]).toMatchObject({ name: "PRPC", region: "SOUTHERN" });
  expect(sites[25]).toMatchObject({ name: "MRCSB", region: "SOUTHERN" });
  expect(sites.find((site) => site.name === "INSTEP").region).toBe("EC");
});
test("reports zero-fill year, current month and last seven calendar dates", () => {
  const report = publicReport([], [], now);
  expect(report.yearly).toHaveLength(12); expect(report.monthly).toHaveLength(31); expect(report.weekly).toHaveLength(7);
  expect(report.weekly[0].key).toBe("2026-09-30"); expect(report.weekly[6].key).toBe("2026-10-06");
  expect(report.totals).toEqual({ opened: 0, closed: 0 });
});
test("opening and closure events use their actual dates, including previous-year openings", () => {
  const events = [
    { createdAt: "2025-12-31T00:00:00Z", closedAt: "2026-10-01T01:00:00Z", status: "CLOSED" },
    { createdAt: "2026-09-30T16:30:00Z", closedAt: "2026-10-05T01:00:00Z", status: "CLOSED" },
    { createdAt: "2026-10-02T01:00:00Z", resolvedAt: "2026-10-02T02:00:00Z", status: "RESOLVED" },
  ];
  const report = publicReport(events, [], now);
  expect(report.totals).toEqual({ opened: 2, closed: 2 });
  expect(report.monthly[0]).toMatchObject({ opened: 1, closed: 1 });
  expect(report.monthly[4].closed).toBe(1); expect(report.yearly[8].opened).toBe(0);
});
test("public latest ticket whitelist excludes names, emails, titles, descriptions and comments", () => {
  const report = publicReport([], [{ category: "HVAC", status: "RESOLVED", createdAt: "2026-10-01T00:00:00Z", resolvedAt: "2026-10-01T01:30:00Z", branch: { name: "TOWER 1", zone: "CENTRAL" }, title: "SECRET", description: "SECRET", comments: [{ message: "SECRET" }], requester: { email: "secret@test.com" } }], now);
  expect(report.latest[0].resolutionHours).toBe(1.5);
  expect(JSON.stringify(report)).not.toContain("SECRET"); expect(JSON.stringify(report)).not.toContain("secret@test.com");
});
test("reopened tickets and future timestamps do not count as closure events", () => {
  const report = publicReport([{ status: "IN_PROGRESS", createdAt: "2026-10-01T00:00:00Z", closedAt: "2026-10-02T00:00:00Z" }, { status: "CLOSED", createdAt: "2026-10-07T00:00:00Z", closedAt: "2026-10-07T01:00:00Z" }], [], now);
  expect(report.totals).toEqual({ opened: 1, closed: 0 });
});

jest.mock("../src/utils/prisma", () => ({ ticket: { findMany: jest.fn() } }));
const request = require("supertest");
const express = require("express");
const prisma = require("../src/utils/prisma");
const app = express(); app.use("/reports", require("../src/routes/reportRoutes"));
app.use((err, req, res, next) => res.status(500).json({ message: "Report unavailable" }));
test("public report is accessible without login and requests no identity fields", async () => {
  prisma.ticket.findMany.mockResolvedValue([]);
  const report = await request(app).get("/reports/public"); expect(report.status).toBe(200); expect(report.body.weekly).toHaveLength(7);
  const latestQuery = prisma.ticket.findMany.mock.calls[1][0]; expect(latestQuery.take).toBe(6);
  expect(latestQuery.select.requester).toBeUndefined(); expect(latestQuery.select.comments).toBeUndefined(); expect(latestQuery.select.title).toBeUndefined();
});
