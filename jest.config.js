module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleDirectories: ["node_modules", "src"],
  setupFiles: ["./jest.setup.js"],
};
