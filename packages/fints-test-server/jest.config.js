module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/__tests__/**/*.ts"],
    collectCoverage: true,
    transform: {
        "^.+\\.ts$": ["ts-jest", {
            tsconfig: {
                experimentalDecorators: true,
                strict: false,
            },
            diagnostics: {
                pathRegex: ".*test-.*\\.ts$",
            },
        }],
    },
    transformIgnorePatterns: [
        "/node_modules/(?!fints-lib)",
    ],
    moduleFileExtensions: ["ts", "js", "json"],
};
