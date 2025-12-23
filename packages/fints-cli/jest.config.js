module.exports = {
  collectCoverage: false,
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      tsconfig: {
        target: "es6",
        module: "commonjs",
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
        types: ["jest", "node"],
        isolatedModules: true,
      },
    }],
  },
  testEnvironment: "node",
  testMatch: ["**/src/**/__tests__/*.test.ts"],
  roots: ["<rootDir>/src"],
  clearMocks: true,
};
