module.exports = {
    collectCoverage: true,
    moduleFileExtensions: ["ts", "js"],
    transform: {
        "^.+\\.ts$": ["ts-jest", {
            diagnostics: {
                pathRegex: ".*test-.*\\.ts$",
            },
            tsconfig: {
                experimentalDecorators: true,
            },
        }],
    },
    coverageReporters: ["lcov", "text-summary"],
    testMatch: ["**/src/**/__tests__/test-*.ts"],
    coveragePathIgnorePatterns: ["/node_modules/", "/__tests__/"],
    collectCoverageFrom: ["src/**/*.ts"],
};
