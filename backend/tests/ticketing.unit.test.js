const fs = require('fs');
const path = require('path');

describe('EngineDesk access model', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/controllers/ticketController.js'), 'utf8');

  test('defines SLA targets for every supported priority', () => {
    expect(source).toContain("CRITICAL: [1, 4]");
    expect(source).toContain("HIGH: [4, 12]");
    expect(source).toContain("MEDIUM: [8, 24]");
    expect(source).toContain("LOW: [24, 72]");
  });

  test('keeps staff, branch manager and HQ ticket scopes distinct', () => {
    expect(source).toContain("user.role === 'HQ_ADMIN' ? {}");
    expect(source).toContain("user.role === 'BRANCH_MANAGER' ? { branchId: user.branchId }");
    expect(source).toContain('{ requesterId: user.id }');
  });
});
