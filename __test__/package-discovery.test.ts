import { PackageDiscovery } from '../src/package-discovery';
import {
    mockPackageLockV3,
    mockPackageLockV1,
    mockPackageJson,
    createMockFS,
    mockFileExists,
    mockFileNotExists
} from './helpers';

// Mock fs/promises
jest.mock('fs/promises');
import fs from 'fs/promises';

describe('PackageDiscovery', () => {
    let packageDiscovery: PackageDiscovery;
    let mockFS: any;

    beforeEach(() => {
        packageDiscovery = new PackageDiscovery();
        mockFS = createMockFS();

        // Replace fs methods
        (fs.readFile as jest.Mock) = mockFS.readFile;
        (fs.readdir as jest.Mock) = mockFS.readdir;
        (fs.access as jest.Mock) = mockFS.access;
    });

    describe('discoverPackages', () => {
        it('should discover packages from package-lock.json v3', async () => {
            mockFileExists(mockFS, 'package-lock.json', JSON.stringify(mockPackageLockV3));
            mockFileNotExists(mockFS, 'node_modules');

            const packages = await packageDiscovery.discoverPackages('/test/project');

            expect(packages.size).toBe(3);
            expect(packages.get('lodash')).toEqual({
                name: 'lodash',
                version: '4.17.19',
                source: 'package-lock'
            });
            expect(packages.get('express')).toEqual({
                name: 'express',
                version: '4.18.0',
                source: 'package-lock'
            });
            expect(packages.get('@types/node')).toEqual({
                name: '@types/node',
                version: '18.0.0',
                source: 'package-lock'
            });
        });

        it('should discover packages from package-lock.json v1', async () => {
            mockFileExists(mockFS, 'package-lock.json', JSON.stringify(mockPackageLockV1));
            mockFileNotExists(mockFS, 'node_modules');

            const packages = await packageDiscovery.discoverPackages('/test/project');

            expect(packages.size).toBe(3);
            expect(packages.get('lodash')).toEqual({
                name: 'lodash',
                version: '4.17.19',
                source: 'package-lock'
            });
            expect(packages.get('express')).toEqual({
                name: 'express',
                version: '4.18.0',
                source: 'package-lock'
            });
            expect(packages.get('express/body-parser')).toEqual({
                name: 'express/body-parser',
                version: '1.19.0',
                source: 'package-lock'
            });
        });

        it('should handle missing package-lock.json gracefully', async () => {
            mockFileNotExists(mockFS, 'package-lock.json');
            mockFileNotExists(mockFS, 'node_modules');

            const packages = await packageDiscovery.discoverPackages('/test/project');

            expect(packages.size).toBe(0);
        });

        it('should discover packages from node_modules', async () => {
            mockFileNotExists(mockFS, 'package-lock.json');
            mockFileExists(mockFS, 'node_modules');

            // Mock node_modules directory structure
            mockFS.readdir.mockImplementation((path: string, options: any) => {
                if (path.includes('node_modules') && !path.includes('@types')) {
                    return Promise.resolve([
                        { name: 'lodash', isDirectory: () => true },
                        { name: '@types', isDirectory: () => true },
                        { name: 'package.json', isDirectory: () => false }
                    ]);
                }
                if (path.includes('@types')) {
                    return Promise.resolve([
                        { name: 'node', isDirectory: () => true }
                    ]);
                }
                return Promise.resolve([]);
            });

            // Mock package.json files
            mockFS.readFile.mockImplementation((path: string) => {
                if (path.includes('lodash/package.json')) {
                    return Promise.resolve(JSON.stringify({ name: 'lodash', version: '4.17.19' }));
                }
                if (path.includes('@types/node/package.json')) {
                    return Promise.resolve(JSON.stringify({ name: '@types/node', version: '18.0.0' }));
                }
                return Promise.reject(new Error('File not found'));
            });

            const packages = await packageDiscovery.discoverPackages('/test/project');

            expect(packages.size).toBe(2);
            expect(packages.get('lodash')).toEqual({
                name: 'lodash',
                version: '4.17.19',
                source: 'node_modules'
            });
            expect(packages.get('@types/node')).toEqual({
                name: '@types/node',
                version: '18.0.0',
                source: 'node_modules'
            });
        });

        it('should prioritize package-lock.json over node_modules', async () => {
            // Package exists in both package-lock and node_modules
            mockFileExists(mockFS, 'package-lock.json', JSON.stringify({
                packages: {
                    'node_modules/lodash': {
                        name: 'lodash',
                        version: '4.17.19'
                    }
                }
            }));

            mockFileExists(mockFS, 'node_modules');
            mockFS.readdir.mockResolvedValue([
                { name: 'lodash', isDirectory: () => true }
            ]);
            // Make readFile handle both package-lock and package.json paths
            mockFS.readFile.mockImplementation((filePath: string) => {
                if (filePath.includes('package-lock.json')) {
                    return Promise.resolve(JSON.stringify({
                        packages: {
                            'node_modules/lodash': {
                                name: 'lodash',
                                version: '4.17.19'
                            }
                        }
                    }));
                }
                if (filePath.includes('lodash/package.json')) {
                    return Promise.resolve(JSON.stringify({ name: 'lodash', version: '4.17.20' }));
                }
                return Promise.reject(new Error('File not found'));
            });

            const packages = await packageDiscovery.discoverPackages('/test/project');

            expect(packages.size).toBe(1);
            // Should use version from package-lock, not node_modules
            expect(packages.get('lodash')).toEqual({
                name: 'lodash',
                version: '4.17.19',
                source: 'package-lock'
            });
        });

        it('should handle malformed package.json files', async () => {
            mockFileNotExists(mockFS, 'package-lock.json');
            mockFileExists(mockFS, 'node_modules');

            mockFS.readdir.mockResolvedValue([
                { name: 'bad-package', isDirectory: () => true }
            ]);

            mockFS.readFile.mockImplementation((path: string) => {
                if (path.includes('bad-package/package.json')) {
                    return Promise.resolve('{ invalid json }');
                }
                return Promise.reject(new Error('File not found'));
            });

            const packages = await packageDiscovery.discoverPackages('/test/project');

            expect(packages.size).toBe(0);
        });
    });

    describe('extractNameFromPath', () => {
        it('should extract regular package names', () => {
            const discovery = new PackageDiscovery() as any;

            expect(discovery.extractNameFromPath('node_modules/lodash')).toBe('lodash');
            expect(discovery.extractNameFromPath('node_modules/express')).toBe('express');
        });

        it('should extract scoped package names', () => {
            const discovery = new PackageDiscovery() as any;

            expect(discovery.extractNameFromPath('node_modules/@types/node')).toBe('@types/node');
            expect(discovery.extractNameFromPath('node_modules/@babel/core')).toBe('@babel/core');
        });
    });
});