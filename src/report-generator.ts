import { ScanResult, VulnerabilityResult } from './types.js';

export class ReportGenerator {
    generateConsoleReport(result: ScanResult): void {
        console.log('\n' + '='.repeat(60));
        console.log('🚨 SECURITY SCAN REPORT');
        console.log('='.repeat(60));

        if (result.vulnerabilities.length === 0) {
            this.generateCleanReport(result);
        } else {
            this.generateVulnerabilityReport(result);
        }

        this.generateSummary(result);
        this.generateDisclaimer();
        this.generateConclusion(result);
    }

    generateJsonReport(result: ScanResult): string {
        const jsonResult = {
            summary: {
                totalPackages: result.totalPackages,
                vulnerablePackages: result.vulnerablePackages,
                totalVulnerabilities: result.totalVulnerabilities,
                isVulnerable: result.vulnerabilities.length > 0
            },
            packages: Array.from(result.packages.values()),
            vulnerabilities: result.vulnerabilities.map(v => ({
                package: v.package,
                vulnerabilityCount: v.vulns.length,
                vulnerabilities: v.vulns
            })),
            scannedAt: new Date().toISOString(),
            dataSource: 'OSV (Open Source Vulnerabilities)'
        };

        return JSON.stringify(jsonResult, null, 2);
    }

    /**
     * Generate a plain-text report as a string (same content as console report)
     * so callers can write it to disk if needed.
     */
    generateTextReport(result: ScanResult): string {
        const lines: string[] = [];
        lines.push('\n' + '='.repeat(60));
        lines.push('🚨 SECURITY SCAN REPORT');
        lines.push('='.repeat(60));

        if (result.vulnerabilities.length === 0) {
            lines.push('\n🎉 Great news! No known vulnerabilities found in your packages.');
            lines.push(`   Scanned ${result.totalPackages} packages total.`);
        } else {
            lines.push(`\n⚠️  Found vulnerabilities in ${result.vulnerablePackages} packages:`);
            lines.push(`   (out of ${result.totalPackages} total packages scanned)\n`);

            const sortedVulns = [...result.vulnerabilities].sort((a, b) => b.vulns.length - a.vulns.length);
            for (const { package: pkg, vulns } of sortedVulns) {
                lines.push(`📦 ${pkg.name}@${pkg.version}`);
                lines.push(`   Source: ${pkg.source}`);
                lines.push(`   Reason: ${pkg.reason}`);
                lines.push(`   Vulnerabilities: ${vulns.length}`);

                const displayVulns = vulns.slice(0, 5);
                for (const vuln of displayVulns) {
                    lines.push(`   - ${vuln.id} (modified: ${vuln.modified.split('T')[0]})`);
                }

                if (vulns.length > 5) {
                    lines.push(`   ... and ${vulns.length - 5} more`);
                }

                lines.push(`   🔗 Details: https://osv.dev/vulnerability/${vulns[0].id}`);
                lines.push('');
            }
        }

        // Summary
        const packageLockPackages = Array.from(result.packages.values())
            .filter(p => p.source === 'package-lock').length;
        const nodeModulesPackages = Array.from(result.packages.values())
            .filter(p => p.source === 'node_modules').length;

        lines.push('📊 SCAN SUMMARY');
        lines.push(`   Total packages scanned: ${result.totalPackages}`);
        lines.push(`   From package-lock.json: ${packageLockPackages}`);
        lines.push(`   From node_modules: ${nodeModulesPackages}`);
        lines.push(`   Vulnerable packages: ${result.vulnerablePackages}`);
        lines.push(`   Total vulnerabilities: ${result.totalVulnerabilities}`);

        lines.push('\n' + '='.repeat(60));
        lines.push('ℹ️  DISCLAIMER');
        lines.push('='.repeat(60));
        lines.push('This scan uses data from OSV (Open Source Vulnerabilities).');
        lines.push('We take no responsibility for the accuracy or completeness');
        lines.push('of these results. Always verify findings independently.');
        lines.push('For more info: https://osv.dev/');
        lines.push('='.repeat(60));

        if (result.vulnerabilities.length > 0) {
            lines.push('\n💀 You might be doomed! Consider updating vulnerable packages.');
        } else {
            lines.push('\n✅  You are NOT doomed today! Stay vigilant.');
        }

        return lines.join('\n');
    }

    private generateCleanReport(result: ScanResult): void {
        console.log('\n🎉 Great news! No known vulnerabilities found in your packages.');
        console.log(`   Scanned ${result.totalPackages} packages total.`);
    }

    private generateVulnerabilityReport(result: ScanResult): void {
        console.log(`\n⚠️  Found vulnerabilities in ${result.vulnerablePackages} packages:`);
        console.log(`   (out of ${result.totalPackages} total packages scanned)\n`);

        // Sort by vulnerability count (most dangerous first)
        const sortedVulns = [...result.vulnerabilities].sort((a, b) => b.vulns.length - a.vulns.length);

        for (const { package: pkg, vulns } of sortedVulns) {
            console.log(`📦 ${pkg.name}@${pkg.version}`);
            console.log(`   Source: ${pkg.source}`);
            console.log(`   Reason: ${pkg.reason}`);
            console.log(`   Vulnerabilities: ${vulns.length}`);

            // Show first few vulnerability IDs
            const displayVulns = vulns.slice(0, 5);
            for (const vuln of displayVulns) {
                console.log(`   - ${vuln.id} (modified: ${vuln.modified.split('T')[0]})`);
            }

            if (vulns.length > 5) {
                console.log(`   ... and ${vulns.length - 5} more`);
            }

            console.log(`   🔗 Details: https://osv.dev/vulnerability/${vulns[0].id}`);
            console.log('');
        }
    }

    private generateSummary(result: ScanResult): void {
        const packageLockPackages = Array.from(result.packages.values())
            .filter(p => p.source === 'package-lock').length;
        const nodeModulesPackages = Array.from(result.packages.values())
            .filter(p => p.source === 'node_modules').length;

        console.log('📊 SCAN SUMMARY');
        console.log(`   Total packages scanned: ${result.totalPackages}`);
        console.log(`   From package-lock.json: ${packageLockPackages}`);
        console.log(`   From node_modules: ${nodeModulesPackages}`);
        console.log(`   Vulnerable packages: ${result.vulnerablePackages}`);
        console.log(`   Total vulnerabilities: ${result.totalVulnerabilities}`);
    }

    private generateDisclaimer(): void {
        console.log('\n' + '='.repeat(60));
        console.log('ℹ️  DISCLAIMER');
        console.log('='.repeat(60));
        console.log('This scan uses data from OSV (Open Source Vulnerabilities).');
        console.log('We take no responsibility for the accuracy or completeness');
        console.log('of these results. Always verify findings independently.');
        console.log('For more info: https://osv.dev/');
        console.log('='.repeat(60));
    }

    private generateConclusion(result: ScanResult): void {
        if (result.vulnerabilities.length > 0) {
            console.log('\n💀 You might be doomed! Consider updating vulnerable packages.');
        } else {
            console.log('\n✅  You are NOT doomed today! Stay vigilant.');
        }
    }
}