import { PackageDiscovery } from './package-discovery.js';
import { OSVClient } from './osv-client.js';
import { ReportGenerator } from './report-generator.js';
import { ScanResult, ScanOptions } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

export class AmIDoomedScanner {
    private packageDiscovery: PackageDiscovery;
    private osvClient: OSVClient;
    private reportGenerator: ReportGenerator;

    constructor() {
        this.packageDiscovery = new PackageDiscovery();
        this.osvClient = new OSVClient();
        this.reportGenerator = new ReportGenerator();
    }

    async scan(options: ScanOptions = {}): Promise<ScanResult> {
        const projectPath = options.projectPath || process.cwd();

        if (!options.silent) {
            console.log('🔍 Scanning project for installed packages...\n');
        }

        try {
            // Discover all packages
            const packages = await this.packageDiscovery.discoverPackages(projectPath);

            if (!options.silent) {
                console.log(`📦 Found ${packages.size} unique packages\n`);
            }

            // Query OSV for vulnerabilities
            const vulnerabilities = await this.osvClient.queryVulnerabilities(Array.from(packages.values()));

            // Create scan result
            const result: ScanResult = {
                packages,
                vulnerabilities,
                totalPackages: packages.size,
                vulnerablePackages: vulnerabilities.length,
                totalVulnerabilities: vulnerabilities.reduce((sum, v) => sum + v.vulns.length, 0)
            };

            return result;

        } catch (error: any) {
            if (!options.silent) {
                console.error('❌ Error during scan:', error.message);
            }
            throw error;
        }
    }

    async scanAndReport(options: ScanOptions = {}): Promise<ScanResult> {
        const result = await this.scan(options);

        if (!options.silent) {
            if (options.jsonOutput) {
                console.log(this.reportGenerator.generateJsonReport(result));
            } else {
                this.reportGenerator.generateConsoleReport(result);
            }
        }

        // If an output path was provided, write the report to disk.
        if (options.outputPath) {
            try {
                const outDir = path.dirname(options.outputPath);
                // Ensure directory exists
                if (!fs.existsSync(outDir)) {
                    fs.mkdirSync(outDir, { recursive: true });
                }

                // Decide whether to write JSON or text
                const shouldWriteJson = options.jsonOutput || options.outputPath.endsWith('.json');
                const content = shouldWriteJson
                    ? this.reportGenerator.generateJsonReport(result)
                    : this.reportGenerator.generateTextReport(result);

                fs.writeFileSync(options.outputPath, content, { encoding: 'utf8' });

                if (!options.silent) {
                    console.log(`\nSaved report to: ${options.outputPath}`);
                }
            } catch (err: any) {
                if (!options.silent) {
                    console.error('Failed to write report to disk:', err.message);
                }
                // Don't fail the scan because of write errors; return result but surface error in console.
            }
        }

        return result;
    }
}