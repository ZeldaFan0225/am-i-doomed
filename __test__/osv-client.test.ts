import { OSVClient } from '../src/osv-client';
import {
    mockPackages,
    mockOSVResponseClean,
    mockOSVResponseWithVulns,
    mockOSVResponseWithPagination,
    mockOSVPaginatedResponse,
    mockFetch,
    mockFetchError
} from './helpers';

describe('OSVClient', () => {
    let osvClient: OSVClient;

    beforeEach(() => {
        osvClient = new OSVClient();
    });

    describe('queryVulnerabilities', () => {
        it('should return empty array when no vulnerabilities found', async () => {
            global.fetch = mockFetch(mockOSVResponseClean);

            const result = await osvClient.queryVulnerabilities(mockPackages);

            expect(result).toHaveLength(0);
            expect(fetch).toHaveBeenCalledWith('https://api.osv.dev/v1/querybatch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    queries: [
                        {
                            package: { name: 'lodash', ecosystem: 'npm' },
                            version: '4.17.19'
                        },
                        {
                            package: { name: 'express', ecosystem: 'npm' },
                            version: '4.18.0'
                        },
                        {
                            package: { name: '@types/node', ecosystem: 'npm' },
                            version: '18.0.0'
                        }
                    ]
                })
            });
        });

        it('should return vulnerabilities when found', async () => {
            global.fetch = mockFetch(mockOSVResponseWithVulns);

            const result = await osvClient.queryVulnerabilities(mockPackages);

            expect(result).toHaveLength(2);

            // First vulnerable package (lodash)
            expect(result[0].package.name).toBe('lodash');
            expect(result[0].vulns).toHaveLength(2);
            expect(result[0].vulns[0].id).toBe('GHSA-35jh-r3h4-6jhm');
            expect(result[0].vulns[1].id).toBe('GHSA-4xc9-xhrj-v574');

            // Second vulnerable package (@types/node)
            expect(result[1].package.name).toBe('@types/node');
            expect(result[1].vulns).toHaveLength(1);
            expect(result[1].vulns[0].id).toBe('GHSA-xyz-123-abc');
        });

        it('should handle API errors gracefully', async () => {
            global.fetch = mockFetch(null, false, 500);

            const result = await osvClient.queryVulnerabilities(mockPackages);

            expect(result).toHaveLength(0);
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('❌ Error querying batch 1:')
            );
        });

        it('should handle network errors', async () => {
            global.fetch = mockFetchError('Network error');

            const result = await osvClient.queryVulnerabilities(mockPackages);

            expect(result).toHaveLength(0);
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('❌ Error querying batch 1:')
            );
        });

        it('should process packages in batches', async () => {
            // Create 150 packages to test batching (batch size is 100)
            const manyPackages = Array.from({ length: 150 }, (_, i) => ({
                name: `package-${i}`,
                version: '1.0.0',
                source: 'package-lock' as const,
                reason: 'Test package'
            }));

            const batchResponse1 = {
                results: Array.from({ length: 100 }, () => ({ vulns: [] }))
            };
            const batchResponse2 = {
                results: Array.from({ length: 50 }, () => ({ vulns: [] }))
            };

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(batchResponse1)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(batchResponse2)
                });

            const result = await osvClient.queryVulnerabilities(manyPackages);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(0); // No vulnerabilities in mock response
        });

        it('should handle pagination correctly', async () => {
            // Mock initial response with pagination
            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockOSVResponseWithPagination)
                })
                // Mock paginated response
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockOSVPaginatedResponse)
                });

            const result = await osvClient.queryVulnerabilities(mockPackages);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(1);

            // Should have combined vulnerabilities from both pages
            expect(result[0].package.name).toBe('lodash');
            expect(result[0].vulns).toHaveLength(3); // 1 from first page + 2 from second page
            expect(result[0].vulns[0].id).toBe('GHSA-page1-vuln1');
            expect(result[0].vulns[1].id).toBe('GHSA-page2-vuln1');
            expect(result[0].vulns[2].id).toBe('GHSA-page2-vuln2');

            // Check pagination request
            expect(fetch).toHaveBeenNthCalledWith(2, 'https://api.osv.dev/v1/querybatch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    queries: [
                        {
                            package: { name: 'lodash', ecosystem: 'npm' },
                            version: '4.17.19',
                            page_token: 'token123'
                        }
                    ]
                })
            });
        });

        it('should handle pagination errors gracefully', async () => {
            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockOSVResponseWithPagination)
                })
                // Mock pagination request failure
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                    json: jest.fn().mockRejectedValue(new Error('JSON parse error'))
                });

            const result = await osvClient.queryVulnerabilities(mockPackages);

            expect(result).toHaveLength(1);
            // Should still have the first page of results
            expect(result[0].vulns).toHaveLength(1);
            expect(result[0].vulns[0].id).toBe('GHSA-page1-vuln1');
        });

        it('should handle multiple packages with pagination', async () => {
            const multiPaginationResponse = {
                results: [
                    {
                        vulns: [{ id: 'VULN-1', modified: '2021-01-01T00:00:00Z' }],
                        next_page_token: 'token1'
                    },
                    { vulns: [] },
                    {
                        vulns: [{ id: 'VULN-2', modified: '2021-02-01T00:00:00Z' }],
                        next_page_token: 'token2'
                    }
                ]
            };

            const paginationResponse = {
                results: [
                    {
                        vulns: [{ id: 'VULN-1-PAGE2', modified: '2021-01-02T00:00:00Z' }]
                    },
                    {
                        vulns: [{ id: 'VULN-2-PAGE2', modified: '2021-02-02T00:00:00Z' }]
                    }
                ]
            };

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(multiPaginationResponse)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(paginationResponse)
                });

            const result = await osvClient.queryVulnerabilities(mockPackages);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(2);

            // First package should have vulnerabilities from both pages
            expect(result[0].package.name).toBe('lodash');
            expect(result[0].vulns).toHaveLength(2);
            expect(result[0].vulns.map(v => v.id)).toEqual(['VULN-1', 'VULN-1-PAGE2']);

            // Third package should have vulnerabilities from both pages
            expect(result[1].package.name).toBe('@types/node');
            expect(result[1].vulns).toHaveLength(2);
            expect(result[1].vulns.map(v => v.id)).toEqual(['VULN-2', 'VULN-2-PAGE2']);
        });
    });
});