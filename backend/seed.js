require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();
const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
const sla = { CRITICAL: [1, 4], HIGH: [4, 12], MEDIUM: [8, 24], LOW: [24, 72] };

async function main() {
  const staffHash = await bcrypt.hash("password123", 12);
  const adminHash = await bcrypt.hash("admin123", 12);
  const states = [
    "Selangor",
    "Johor",
    "Penang",
    "Pahang",
    "Sabah",
    "Sarawak",
    "Perak",
    "Kedah",
    "Kelantan",
    "Terengganu",
    "Perlis",
    "Negeri Sembilan",
    "Melaka",
    "Kuala Lumpur",
    "Putrajaya",
    "Labuan",
  ];
  const allBranches = await Promise.all(
    states.map((name, i) =>
      prisma.branch.upsert({
        where: { code: `BR${i + 1}` },
        update: { name, location: name },
        create: { code: `BR${i + 1}`, name, location: name },
      }),
    ),
  );
  const branches = allBranches.slice(0, 3);
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
        update: {},
        create: {
          email: `managerbranch${n}@test.com`,
          name: `Branch ${n} Manager`,
          role: "BRANCH_MANAGER",
          branchId: branch.id,
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
          },
        });
        continue;
      }
    }
    await prisma.user.upsert({
      where: { email },
      update: {
        name: `Test User ${i}`,
        branchId: branches[0].id,
        role: "STAFF",
      },
      create: {
        email,
        name: `Test User ${i}`,
        branchId: branches[0].id,
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
      ["Loading bay camera offline", "CCTV", "MEDIUM", "ACKNOWLEDGED"],
      ["Smoke detector fault on Level 2", "Fire Alarm", "CRITICAL", "NEW"],
      ["Building automation schedule incorrect", "BAS", "LOW", "WAITING"],
      ["Gas pressure sensor inspection", "Gas System", "HIGH", "RESOLVED"],
      ["Passenger lift door fault", "Elevator", "CRITICAL", "RESOLVED"],
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
          ].includes(status)
            ? hoursAgo((i + 1) * 20 - 0.5)
            : null,
          resolvedAt:
            status === "RESOLVED"
              ? hoursAgo(
                  (i + 1) * 20 - (i % 2 ? resolution + 2 : resolution - 1),
                )
              : null,
        },
      });
    }
  }
  console.log("Seed complete. Staff: password123; managers/HQ: admin123.");
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
