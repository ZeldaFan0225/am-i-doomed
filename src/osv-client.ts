import { PackageInfo, OSVQuery, OSVBatchResponse, OSVVuln, VulnerabilityResult, OSVResult } from './types.js';

export class OSVClient {
    private static readonly BASE_URL = 'https://api.osv.dev';
    private static readonly BATCH_SIZE = 100;

    async queryVulnerabilities(packages: PackageInfo[], silent = false): Promise<VulnerabilityResult[]> {
        const vulnerabilities: VulnerabilityResult[] = [];
        const packageArray = Array.from(packages);

        if (!silent) console.log('🌐 Querying OSV database for vulnerabilities...\n');

        // Process packages in batches
        for (let i = 0; i < packageArray.length; i += OSVClient.BATCH_SIZE) {
            const batch = packageArray.slice(i, i + OSVClient.BATCH_SIZE);
            const batchResults = await this.queryBatch(
                batch,
                Math.floor(i / OSVClient.BATCH_SIZE) + 1,
                Math.ceil(packageArray.length / OSVClient.BATCH_SIZE),
                silent
            );
            vulnerabilities.push(...batchResults);
        }

        return vulnerabilities;
    }

    private async queryBatch(
        packages: PackageInfo[],
        batchNum: number,
        totalBatches: number,
        silent = false
    ): Promise<VulnerabilityResult[]> {
        const vulnerabilities: VulnerabilityResult[] = [];

        const queries: OSVQuery[] = packages.map(pkg => ({
            package: {
                name: pkg.name,
                ecosystem: 'npm'
            },
            version: pkg.version
        }));

        try {
            if (!silent) console.log(`  Batch ${batchNum}/${totalBatches}: Checking ${packages.length} packages...`);

            const response = await fetch(`${OSVClient.BASE_URL}/v1/querybatch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ queries })
            });

            if (!response.ok) {
                throw new Error(`OSV API error: ${response.status} ${response.statusText}`);
            }

            const data: OSVBatchResponse = await response.json() as OSVBatchResponse;

            // Process results
            for (let i = 0; i < data.results.length; i++) {
                const result = data.results[i];
                const packageInfo = packages[i];

                if (result.vulns && result.vulns.length > 0) {
                    // Copy the vulns array so we don't hold a reference to the
                    // original response object (tests may reuse/mutate those mocks).
                    const vulnResult: VulnerabilityResult = {
                        package: packageInfo,
                        vulns: Array.isArray(result.vulns) ? result.vulns.slice() : []
                    };

                    vulnerabilities.push(vulnResult);
                }
            }

            // Handle pagination for packages that have more results
            await this.handleBatchPagination(packages, data.results, vulnerabilities, silent);

        } catch (error: any) {
            if (!silent) console.error(`❌ Error querying batch ${batchNum}: ${error?.message ?? String(error)}`);
        }

        return vulnerabilities;
    }

    private async handleBatchPagination(
        packages: PackageInfo[],
        results: OSVResult[],
        vulnerabilities: VulnerabilityResult[],
        silent = false
    ): Promise<void> {
        // Collect packages that need pagination
        const paginationQueries: OSVQuery[] = [];
        // Map from package name to index in `vulnerabilities` array
        const paginationMappingByName: { [pkgName: string]: number } = {};

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.next_page_token) {
                const pkgName = packages[i].name;
                paginationMappingByName[pkgName] = vulnerabilities.findIndex(v => v.package.name === pkgName);

                paginationQueries.push({
                    package: {
                        name: pkgName,
                        ecosystem: 'npm'
                    },
                    version: packages[i].version,
                    page_token: result.next_page_token
                });
            }
        }

        // If no pagination needed, return
        if (paginationQueries.length === 0) {
            return;
        }

        // Process paginated queries
        let hasMorePages = true;
        let currentQueries = paginationQueries;

        while (hasMorePages && currentQueries.length > 0) {
            try {
                // pagination request
                const response = await fetch(`${OSVClient.BASE_URL}/v1/querybatch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ queries: currentQueries })
                });

                if (!response.ok) {
                    if (!silent) console.error(`Error in pagination request: ${response.statusText}`);
                    break;
                }
                const data: OSVBatchResponse = await response.json() as OSVBatchResponse;

                // Process paginated results
                const nextQueries: OSVQuery[] = [];
                for (let i = 0; i < data.results.length; i++) {
                    const result = data.results[i];
                    const queryPkgName = currentQueries[i].package.name;
                    const vulnerabilityIndex = paginationMappingByName[queryPkgName];

                    // Add additional vulnerabilities to existing result
                    if (typeof vulnerabilityIndex === 'number' && vulnerabilityIndex >= 0 && result.vulns && result.vulns.length > 0) {
                        vulnerabilities[vulnerabilityIndex].vulns.push(...result.vulns);
                    }

                    // Check if this result has more pages
                    if (result.next_page_token) {
                        nextQueries.push({
                            ...currentQueries[i],
                            page_token: result.next_page_token
                        });
                    }
                }

                // Prepare for next iteration
                currentQueries = nextQueries;
                hasMorePages = nextQueries.length > 0;

            } catch (error: any) {
                if (!silent) console.error(`Error handling batch pagination: ${error?.message ?? String(error)}`);
                break;
            }
        }
    }
}