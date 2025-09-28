import { AmIDoomedScanner } from '../src/scanner';
import { PackageDiscovery } from '../src/package-discovery';
import { OSVClient } from '../src/osv-client';
import { ReportGenerator } from '../src/report-generator';
import { mockPackages } from './helpers';

// Mock the dependencies
jest.mock('../src/package-discovery');
jest.mock('../src/osv-client');
jest.mock('../src/report-generator');

describe('AmIDoomedScanner', () => {
    let scanner: AmIDoomedScanner;
    let mockPackageDiscovery: jest.Mocked<PackageDiscovery>;
    let mockOSVClient: jest.Mocked<OSVClient>;
    let mockReportGenerator: jest.Mocked<ReportGenerator>;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Create mocked instances
        mockPackageDiscovery = {
            discoverPackages: jest.fn()
        } as any;

        mockOSVClient = {
            queryVulnerabilities: jest.fn()
        } as any;

        mockReportGenerator = {
            generateConsoleReport: jest.fn(),
            generateJsonReport: jest.fn()
        } as any;

        // Mock the constructors
        (PackageDiscovery as unknown as jest.Mock).mockImplementation(() => mockPackageDiscovery);
        (OSVClient as unknown as jest.Mock).mockImplementation(() => mockOSVClient);
        (ReportGenerator as unknown as jest.Mock).mockImplementation(() => mockReportGenerator);

        scanner = new AmIDoomedScanner();
    });

    describe('scan', () => {
        it('should scan successfully with no vulnerabilities', async () => {
            const mockPackagesMap = new Map();
            mockPackages.forEach(pkg => mockPackagesMap.set(pkg.name, pkg));

            mockPackageDiscovery.discoverPackages.mockResolvedValue(mockPackagesMap);
            mockOSVClient.queryVulnerabilities.mockResolvedValue([]);

            const result = await scanner.scan({ projectPath: '/test/project' });

            expect(mockPackageDiscovery.discoverPackages).toHaveBeenCalledWith('/test/project', false);
            expect(mockOSVClient.queryVulnerabilities).toHaveBeenCalledWith(mockPackages, false);

            expect(result).toEqual({
                packages: mockPackagesMap,
                vulnerabilities: [],
                totalPackages: 3,
                vulnerablePackages: 0,
                totalVulnerabilities: 0
            });
        });

        it('should scan successfully with vulnerabilities', async () => {
            const mockPackagesMap = new Map();
            mockPackages.forEach(pkg => mockPackagesMap.set(pkg.name, pkg));

            const mockVulnerabilities = [
                {
                    package: mockPackages[0], // lodash
                    vulns: [
                        { id: 'GHSA-123', modified: '2021-01-01T00:00:00Z' },
                        { id: 'GHSA-456', modified: '2021-02-01T00:00:00Z' }
                    ]
                }
            ];

            mockPackageDiscovery.discoverPackages.mockResolvedValue(mockPackagesMap);
            mockOSVClient.queryVulnerabilities.mockResolvedValue(mockVulnerabilities);

            const result = await scanner.scan({ projectPath: '/test/project' });

            expect(result).toEqual({
                packages: mockPackagesMap,
                vulnerabilities: mockVulnerabilities,
                totalPackages: 3,
                vulnerablePackages: 1,
                totalVulnerabilities: 2
            });
        });

        it('should use current working directory as default', async () => {
            const originalCwd = process.cwd;
            // @ts-ignore
            process.cwd = jest.fn().mockReturnValue('/current/dir');

            mockPackageDiscovery.discoverPackages.mockResolvedValue(new Map());
            mockOSVClient.queryVulnerabilities.mockResolvedValue([]);

            await scanner.scan();

            expect(mockPackageDiscovery.discoverPackages).toHaveBeenCalledWith('/current/dir', false);

            // Restore original
            // @ts-ignore
            process.cwd = originalCwd;
        });

        it('scanAndReport should print JSON when jsonOutput is true', async () => {
            const mockPackagesMap = new Map();
            mockPackages.forEach(pkg => mockPackagesMap.set(pkg.name, pkg));

            mockPackageDiscovery.discoverPackages.mockResolvedValue(mockPackagesMap);

            const mockResult = {
                packages: mockPackagesMap,
                vulnerabilities: [],
                totalPackages: 3,
                vulnerablePackages: 0,
                totalVulnerabilities: 0
            } as any;

            // Make scan return the mock result
            jest.spyOn(scanner, 'scan' as any).mockResolvedValue(mockResult);

            mockReportGenerator.generateJsonReport.mockReturnValue(JSON.stringify({ ok: true }));

            await scanner.scanAndReport({ projectPath: '/test/project', jsonOutput: true });

            expect(mockReportGenerator.generateJsonReport).toHaveBeenCalledWith(mockResult);
            expect(console.log).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
        });

        it('scanAndReport should call generateConsoleReport when jsonOutput is false', async () => {
            const mockPackagesMap = new Map();
            mockPackages.forEach(pkg => mockPackagesMap.set(pkg.name, pkg));

            mockPackageDiscovery.discoverPackages.mockResolvedValue(mockPackagesMap);

            const mockResult = {
                packages: mockPackagesMap,
                vulnerabilities: [],
                totalPackages: 3,
                vulnerablePackages: 0,
                totalVulnerabilities: 0
            } as any;

            jest.spyOn(scanner, 'scan' as any).mockResolvedValue(mockResult);

            await scanner.scanAndReport({ projectPath: '/test/project', jsonOutput: false });

            expect(mockReportGenerator.generateConsoleReport).toHaveBeenCalledWith(mockResult);
        });
    });
});