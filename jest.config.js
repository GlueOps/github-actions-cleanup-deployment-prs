/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageProvider: "v8",
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts"],
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageThreshold: {
    global: { lines: 85, branches: 80, functions: 90 },
    "./src/lib.ts": { lines: 100, branches: 100, functions: 100 },
  },
};
