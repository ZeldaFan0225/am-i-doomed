export interface PackageInfo {
    name: string;
    version: string;
    source: 'package-lock' | 'node_modules';
}

export interface PackageLockPackageInfo {
    name?: string;
    version?: string;
    dependencies?: Record<string, PackageLockPackageInfo>;
}

export interface PackageLockV2V3 {
    packages?: Record<string, PackageLockPackageInfo>;
    dependencies?: Record<string, PackageLockPackageInfo>;
}

export interface OSVQuery {
    package: {
        name: string;
        ecosystem: string;
    };
    version: string;
    page_token?: string;
}

export interface OSVVuln {
    id: string;
    modified: string;
}

export interface OSVResult {
    vulns?: OSVVuln[];
    next_page_token?: string;
}

export interface OSVBatchResponse {
    results: OSVResult[];
}

export interface VulnerabilityResult {
    package: PackageInfo;
    vulns: OSVVuln[];
}

export interface ScanResult {
    packages: Map<string, PackageInfo>;
    vulnerabilities: VulnerabilityResult[];
    totalPackages: number;
    vulnerablePackages: number;
    totalVulnerabilities: number;
}

export interface ScanOptions {
    projectPath?: string;
    silent?: boolean;
    jsonOutput?: boolean;
    // When provided, save the generated report to this file path.
    // If `jsonOutput` is true (or the file name ends with .json) the JSON
    // report will be written. Otherwise a human-readable text report is written.
    outputPath?: string;
}