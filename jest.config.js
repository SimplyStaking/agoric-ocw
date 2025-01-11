export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  transformIgnorePatterns: [
    "node_modules/@agoric/cosmic-proto"
  ],
  moduleNameMapper: {
    "@src/constants": "<rootDir>/src/constants",
    "@src/types": "<rootDir>/src/types",
    "@lib/(.*)": "<rootDir>/src/lib/$1",
    "@utils/(.*)": "<rootDir>/src/utils/$1",
  },
  rootDir: './',
}
