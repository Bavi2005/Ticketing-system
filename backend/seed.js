require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const hoursAgo = h => new Date(Date.now() - h * 3600000);
const target = h => new Date(Date.now() + h * 3600000);
const sla = { CRITICAL: [1, 4], HIGH: [4, 12], MEDIUM: [8, 24], LOW: [24, 72] };

async function main() {
  const staffHash = await bcrypt.hash('password123', 12);
  const adminHash = await bcrypt.hash('admin123', 12);
  const branches = await Promise.all([1, 2, 3].map(n => prisma.branch.upsert({ where: { code: `BR${n}` }, update: {}, create: { code: `BR${n}`, name: `Branch ${n}`, location: ['Shah Alam', 'Johor Bahru', 'Penang'][n - 1] } })));
  await prisma.user.upsert({ where: { email: 'hq@test.com' }, update: { role: 'HQ_ADMIN', passwordHash: adminHash, name: 'HQ Service Control' }, create: { email: 'hq@test.com', name: 'HQ Service Control', role: 'HQ_ADMIN', passwordHash: adminHash } });
  const managers = [];
  for (const branch of branches) {
    const n = branch.code.slice(-1);
    managers.push(await prisma.user.upsert({ where: { email: `managerbranch${n}@test.com` }, update: { role: 'BRANCH_MANAGER', branchId: branch.id, passwordHash: adminHash, name: `Branch ${n} Manager` }, create: { email: `managerbranch${n}@test.com`, name: `Branch ${n} Manager`, role: 'BRANCH_MANAGER', branchId: branch.id, passwordHash: adminHash } }));
    for (let i = 1; i <= 5; i++) await prisma.user.upsert({ where: { email: `testuser${i}branch${n}@test.com` }, update: { branchId: branch.id, role: 'STAFF', passwordHash: staffHash, name: `Test User ${i} · Branch ${n}` }, create: { email: `testuser${i}branch${n}@test.com`, name: `Test User ${i} · Branch ${n}`, branchId: branch.id, role: 'STAFF', passwordHash: staffHash } });
  }
  if (await prisma.ticket.count() === 0) {
    const staff = await prisma.user.findMany({ where: { role: 'STAFF' }, orderBy: { email: 'asc' } });
    const samples = [['Hydraulic press pressure drop', 'Hydraulic Systems', 'CRITICAL', 'IN_PROGRESS'], ['Workshop lighting failure', 'Facilities', 'HIGH', 'ACKNOWLEDGED'], ['Calibration certificate renewal', 'Quality & Compliance', 'MEDIUM', 'NEW'], ['Forklift service request', 'Fleet & Equipment', 'LOW', 'WAITING'], ['CNC coolant leak', 'Production Equipment', 'HIGH', 'RESOLVED'], ['Network cabinet overheating', 'IT Infrastructure', 'CRITICAL', 'IN_PROGRESS']];
    for (let i = 0; i < samples.length; i++) { const [title, category, priority, status] = samples[i]; const requester = staff[i % staff.length]; const [response, resolution] = sla[priority]; await prisma.ticket.create({ data: { reference: `ENG-${String(i + 101).padStart(4, '0')}`, title, category, priority, status, description: `Demo engineering service request: ${title.toLowerCase()}. A safe assessment and corrective action are required.`, branchId: requester.branchId, requesterId: requester.id, assigneeId: managers[branches.findIndex(b => b.id === requester.branchId)].id, createdAt: hoursAgo((i + 1) * 3), responseDueAt: target(response - i), resolutionDueAt: target(resolution - i * 2), acknowledgedAt: ['ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING', 'RESOLVED'].includes(status) ? hoursAgo(i + 1) : null, resolvedAt: status === 'RESOLVED' ? hoursAgo(1) : null } }); }
  }
  console.log('Seed complete. Staff: password123; managers/HQ: admin123.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
