#!/usr/bin/env node

import { AmIDoomedScanner } from './scanner.js';
import { ScanResult, ScanOptions } from './types.js';

// Main export function
export async function scanPackage(projectPath?: string, options: Omit<ScanOptions, 'projectPath'> = {}): Promise<ScanResult> {
    const scanner = new AmIDoomedScanner();
    return await scanner.scan({
        projectPath,
        ...options
    });
}

// CLI interface
async function runCLI(): Promise<void> {
    const args = process.argv.slice(2);

    // Parse arguments
    const helpFlags = ['--help', '-h'];
    const jsonFlags = ['--json', '-j'];
    const silentFlags = ['--silent', '-s'];
    const outputFlags = ['--output', '-o'];

    if (args.some(arg => helpFlags.includes(arg))) {
        showHelp();
        return;
    }

    // Extract options
    const jsonOutput = args.some(arg => jsonFlags.includes(arg));
    const silent = args.some(arg => silentFlags.includes(arg));

    // Extract output path (supports --output <file>, -o <file>, or --output=path)
    let outputPath: string | undefined;
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (outputFlags.includes(a)) {
            if (i + 1 < args.length) {
                outputPath = args[i + 1];
            }
            break;
        }

        // handle --output=path
        if (a.startsWith('--output=')) {
            outputPath = a.split('=')[1];
            break;
        }
    }

    // Extract project path (first non-flag argument)
    const projectPath = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-')) || process.cwd();

    if (!silent) {
        console.log('💀 AM I DOOMED? - Security Vulnerability Scanner');
        console.log('================================================\n');
    }

    try {
        const scanner = new AmIDoomedScanner();
        const result = await scanner.scanAndReport({
            projectPath,
            silent,
            jsonOutput,
            outputPath
        });

        // Exit with appropriate code
        process.exit(result.vulnerabilities.length > 0 ? 1 : 0);

    } catch (error: any) {
        if (!silent) {
            console.error('💀 Fatal error:', error.message);
        }
        process.exit(1);
    }
}

function showHelp(): void {
    console.log('💀 AM I DOOMED? - Security Vulnerability Scanner');
    console.log('================================================\n');
    console.log('Usage: npx am-i-doomed [project-path] [options]');
    console.log('       am-i-doomed [project-path] [options]');
    console.log('');
    console.log('Scans your Node.js project for known security vulnerabilities');
    console.log('using the OSV (Open Source Vulnerabilities) database.');
    console.log('');
    console.log('Arguments:');
    console.log('  project-path          Path to project directory (default: current directory)');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h           Show this help message');
    console.log('  --json, -j           Output results in JSON format');
    console.log('  --silent, -s         Suppress console output (useful for programmatic use)');
    console.log('  --output <file>, -o  Save the generated report to <file> (use .json for JSON output)');
    console.log('');
    console.log('Examples:');
    console.log('  npx am-i-doomed                    # Scan current directory');
    console.log('  npx am-i-doomed ./my-project       # Scan specific directory');
    console.log('  npx am-i-doomed --json             # Output JSON results');
    console.log('  npx am-i-doomed --silent           # Silent mode (exit codes only)');
    console.log('');
    console.log('Exit Codes:');
    console.log('  0    No vulnerabilities found (you are NOT doomed)');
    console.log('  1    Vulnerabilities found (you might be doomed)');
    console.log('');
    console.log('Data Source: https://osv.dev/');
}

// Export the scanner class for programmatic use
export { AmIDoomedScanner } from './scanner.js';
export * from './types.js';

// Run CLI if this file is executed directly.
// Avoid referencing `import.meta.url` (ESM-only) so this file works when compiled
// as CommonJS for the test environment. Use a defensive runtime check instead.
function isExecutedDirectly(): boolean {
    try {
        // CommonJS check
        if (typeof require !== 'undefined' && require.main === module) return true;
    } catch (e) {
        // ignore
    }

    try {
        // Fallback for some ESM runners: compare resolved script path to argv[1]
        // This avoids using import.meta.url directly.
        const scriptPath = process.argv && process.argv[1];
        if (scriptPath) {
            // On Windows, argv may contain backslashes; normalize by using endsWith check
            return __filename ? scriptPath.endsWith(__filename) : false;
        }
    } catch (e) {
        // ignore
    }

    return false;
}

if (isExecutedDirectly()) {
    runCLI();
}