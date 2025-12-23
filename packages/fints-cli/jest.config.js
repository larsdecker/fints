module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  roots: ['<rootDir>/src'],
  clearMocks: true,
  globals: {
    'ts-jest': {
      tsconfig: {
        lib: ['es2015'],
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        types: ['jest', 'node'],
        noImplicitAny: false,
      },
    },
  },
};
