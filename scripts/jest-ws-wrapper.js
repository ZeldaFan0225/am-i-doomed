#!/usr/bin/env node
// Wrapper to translate WebStorm's old --testPathPattern CLI flag to the
// new --testPathPatterns flag that current Jest expects.
// Usage: node scripts/jest-ws-wrapper.js [jest args...]

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2).map(arg => {
  if (arg.startsWith('--testPathPattern=')) {
    return arg.replace('--testPathPattern=', '--testPathPatterns=');
  }
  // WebStorm sometimes injects a Windows path-like pattern without quoting
  // e.g. --testPathPattern=^C:.Users.robin... we leave other args intact.
  return arg;
});

// Resolve local project's jest binary
const jestBin = path.resolve(__dirname, '..', 'node_modules', 'jest', 'bin', 'jest.js');

const child = spawn(process.execPath, [jestBin, ...args], { stdio: 'inherit' });

child.on('close', code => process.exit(code));
