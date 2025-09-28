module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: [ '<rootDir>/src', '<rootDir>/__test__' ],
    // Match only files that end with .spec.ts or .test.ts to avoid treating helper files
    // (like setup.ts or helpers.ts) in `__test__` as test suites when a directory is passed.
    testMatch: [ '**/?(*.)+(spec|test).ts' ],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/index.ts', // Exclude CLI entry point from coverage
    ],
    coverageDirectory: 'coverage',
    coverageReporters: [ 'text', 'lcov', 'html' ],
    setupFilesAfterEnv: [ '<rootDir>/__test__/setup.ts' ],
    testTimeout: 10000, // OSV API calls might take time
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1', // Handle .js imports in TypeScript
    },
};