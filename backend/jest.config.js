// backend/jest.config.js

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Longer timeout: integration tests hit a real Postgres
  testTimeout: 30000,
  maxWorkers: 1, // serial — tests share one test database
};
