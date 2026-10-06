require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();
const { sites } = require("./src/utils/sites");
const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
const sla = { CRITICAL: [1, 4], HIGH: [4, 12], MEDIUM: [8, 24], LOW: [24, 72] };

async function main() {
  const staffHash = await bcrypt.hash("password123", 12);
  const adminHash = await bcrypt.hash("admin123", 12);
  const allBranches = await Promise.all(sites.map((site) => prisma.branch.upsert({
    where: { code: site.code },
    update: { name: site.name, location: site.name, zone: site.region },
    create: { code: site.code, name: site.name, location: site.name, zone: site.region },
  })));
  // Existing demo accounts follow the region of their retained site ID.
  for (const site of allBranches)
    await prisma.user.updateMany({ where: { branchId: site.id }, data: { zone: site.zone } });
  const demoHash = await bcrypt.hash("DemoSite2026!", 12);
  for (const site of allBranches) {
    const slug = site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    for (const [prefix, role] of [["manager", "BRANCH_MANAGER"], ["tech", "STAFF"]]) {
      await prisma.user.upsert({
        where: { email: `${prefix}-${slug}@test.com` },
        update: {},
        create: { email: `${prefix}-${slug}@test.com`, name: `${site.name} ${prefix === "tech" ? "Technician" : "Manager"}`, role, branchId: site.id, zone: site.zone, passwordHash: demoHash },
      });
    }
  }
  const branches = allBranches.slice(0, 3);
  // Bootstrap a dedicated system-control account; never reset its password on redeploy.
  if (process.env.OPERATOR_EMAIL || process.env.OPERATOR_PASSWORD) {
    const email = String(process.env.OPERATOR_EMAIL || "").trim().toLowerCase();
    const password = process.env.OPERATOR_PASSWORD || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new Error("Set a valid OPERATOR_EMAIL for operator bootstrap");
    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72)
      throw new Error("OPERATOR_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes");
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== "OPERATOR")
      throw new Error("OPERATOR_EMAIL already belongs to a non-operator account; use a dedicated email");
    const operatorUser = existing || await prisma.user.create({
      data: {
        email,
        name: process.env.OPERATOR_NAME || "Platform Operator",
        role: "OPERATOR",
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    await prisma.operator.upsert({
      where: { userId: operatorUser.id },
      update: {},
      create: { name: process.env.OPERATOR_COMPANY || "EngineDesk Operations", userId: operatorUser.id },
    });
  }

  await prisma.user.upsert({
    where: { email: "hq@test.com" },
    update: {},
    create: {
      email: "hq@test.com",
      name: "HQ Service Control",
      role: "HQ_ADMIN",
      passwordHash: adminHash,
    },
  });
  const managers = [];
  for (const branch of branches) {
    const n = branch.code.slice(-1);
    managers.push(
      await prisma.user.upsert({
        where: { email: `managerbranch${n}@test.com` },
        update: { name: `${branch.name} Manager`, zone: branch.zone },
        create: {
          email: `managerbranch${n}@test.com`,
          name: `${branch.name} Manager`,
          role: "BRANCH_MANAGER",
          branchId: branch.id,
          zone: branch.zone,
          passwordHash: adminHash,
        },
      }),
    );
  }
  for (let i = 1; i <= 5; i++) {
    const email = `testuser${i}@test.com`;
    const legacyEmail = `testuser${i}branch1@test.com`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const legacy = await prisma.user.findUnique({
        where: { email: legacyEmail },
      });
      if (legacy) {
        await prisma.user.update({
          where: { id: legacy.id },
          data: {
            email,
            name: `Test User ${i}`,
            branchId: branches[0].id,
            role: "STAFF",
            zone: branches[0].zone,
          },
        });
        continue;
      }
    }
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `Test User ${i}`,
        branchId: branches[0].id,
        zone: branches[0].zone,
        role: "STAFF",
        passwordHash: staffHash,
      },
    });
  }
  for (let branchNumber = 1; branchNumber <= 3; branchNumber++) {
    for (let i = 1; i <= 5; i++) {
      const legacyEmail = `testuser${i}branch${branchNumber}@test.com`;
      const legacy = await prisma.user.findUnique({
        where: { email: legacyEmail },
      });
      if (!legacy) continue;
      await prisma.user.update({
        where: { id: legacy.id },
        data: {
          email: `archived-${legacyEmail}`,
          name: `Archived Test User ${i}`,
        },
      });
    }
  }
  if ((await prisma.ticket.count()) === 0) {
    const staff = [];
    for (let i = 1; i <= 5; i++)
      staff.push(
        await prisma.user.findUnique({
          where: { email: `testuser${i}@test.com` },
        }),
      );
    const samples = [
      ["Air handling unit not cooling", "HVAC", "HIGH", "IN_PROGRESS"],
      ["Loading bay camera offline", "CCTV", "MEDIUM", "IN_PROGRESS"],
      [
        "Smoke detector fault on Level 2",
        "Fire Alarm",
        "CRITICAL",
        "IN_PROGRESS",
      ],
      ["Building automation schedule incorrect", "BAS", "LOW", "WAITING"],
      ["Gas pressure sensor inspection", "Gas System", "HIGH", "RESOLVED"],
      ["Passenger lift door fault", "Elevator", "CRITICAL", "CLOSED"],
    ];
    for (let i = 0; i < 60; i++) {
      const [title, category, priority, status] = samples[i % samples.length];
      const requester = staff[i % staff.length];
      const [response, resolution] = sla[priority];
      await prisma.ticket.create({
        data: {
          reference: `ENG-${String(i + 101).padStart(4, "0")}`,
          title,
          category,
          priority,
          status,
          description: `Demo engineering service request: ${title.toLowerCase()}. A safe assessment and corrective action are required.`,
          branchId: allBranches[i % allBranches.length].id,
          requesterId: requester.id,
          createdAt: hoursAgo((i + 1) * 20),
          responseDueAt: hoursAgo((i + 1) * 20 - response),
          resolutionDueAt: hoursAgo((i + 1) * 20 - resolution),
          acknowledgedAt: [
            "ACKNOWLEDGED",
            "IN_PROGRESS",
            "WAITING",
            "RESOLVED",
            "CLOSED",
          ].includes(status)
            ? hoursAgo((i + 1) * 20 - 0.5)
            : null,
          waitingSince:
            status === "WAITING" ? hoursAgo((i + 1) * 20 - 1) : null,
          closedAt: status === "CLOSED" ? hoursAgo((i + 1) * 20 - (i % 2 ? resolution + 2 : resolution - 1) - .5) : null,
          resolvedAt:
            ["RESOLVED", "CLOSED"].includes(status)
              ? hoursAgo(
                  (i + 1) * 20 - (i % 2 ? resolution + 2 : resolution - 1),
                )
              : null,
        },
      });
    }
  }
  await prisma.ticket.updateMany({
    where: { status: { in: ["NEW", "ACKNOWLEDGED"] } },
    data: { status: "IN_PROGRESS" },
  });
  await prisma.$executeRaw`UPDATE "Ticket" SET "waitingSince" = "updatedAt" WHERE "status" = 'WAITING' AND "waitingSince" IS NULL`;
  console.log("Seed complete. Staff: password123; managers/HQ: admin123.");
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
