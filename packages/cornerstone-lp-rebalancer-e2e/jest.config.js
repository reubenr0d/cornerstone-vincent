module.exports = {
  displayName: '@reubenr0d/lp-rebalancer-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  detectOpenHandles: true,
  // Enable console output
  verbose: true,
  silent: false,
  // Don't suppress console logs
  clearMocks: false,
  restoreMocks: false,
};
