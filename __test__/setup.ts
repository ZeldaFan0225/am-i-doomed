// Test setup file
import 'jest';

// Mock console.log/error for cleaner test output
const originalConsole = global.console;

beforeEach(() => {
    global.console = {
        ...originalConsole,
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };
});

afterEach(() => {
    global.console = originalConsole;
});

// Mock fetch globally for tests
global.fetch = jest.fn();

// Helper to reset all mocks
afterEach(() => {
    jest.resetAllMocks();
});