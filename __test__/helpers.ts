import { PackageInfo, OSVBatchResponse, OSVResult } from '../src/types';

// Mock package-lock.json data
export const mockPackageLockV3 = {
    name: 'test-project',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
        '': {
            name: 'test-project',
            version: '1.0.0'
        },
        'node_modules/lodash': {
            name: 'lodash',
            version: '4.17.19'
        },
        'node_modules/express': {
            name: 'express',
            version: '4.18.0'
        },
        'node_modules/@types/node': {
            name: '@types/node',
            version: '18.0.0'
        }
    }
};

export const mockPackageLockV1 = {
    name: 'test-project',
    version: '1.0.0',
    lockfileVersion: 1,
    dependencies: {
        lodash: {
            version: '4.17.19'
        },
        express: {
            version: '4.18.0',
            dependencies: {
                'body-parser': {
                    version: '1.19.0'
                }
            }
        }
    }
};

// Mock package.json data
export const mockPackageJson = {
    name: 'test-package',
    version: '1.2.3',
    description: 'A test package'
};

// Mock packages
export const mockPackages: PackageInfo[] = [
    { name: 'lodash', version: '4.17.19', source: 'package-lock', reason: 'package-lock.json -> packages["node_modules/lodash"]' },
    { name: 'express', version: '4.18.0', source: 'package-lock', reason: 'package-lock.json -> packages["node_modules/express"]' },
    { name: '@types/node', version: '18.0.0', source: 'node_modules', reason: 'package.json -> node_modules/@types/node/package.json' }
];

// Mock OSV responses
export const mockOSVResponseClean: OSVBatchResponse = {
    results: [
        { vulns: [] },
        { vulns: [] },
        { vulns: [] }
    ]
};

export const mockOSVResponseWithVulns: OSVBatchResponse = {
    results: [
        {
            vulns: [
                {
                    id: 'GHSA-35jh-r3h4-6jhm',
                    modified: '2021-05-06T12:00:00Z'
                },
                {
                    id: 'GHSA-4xc9-xhrj-v574',
                    modified: '2021-02-12T12:00:00Z'
                }
            ]
        },
        { vulns: [] },
        {
            vulns: [
                {
                    id: 'GHSA-xyz-123-abc',
                    modified: '2023-01-01T12:00:00Z'
                }
            ]
        }
    ]
};

export const mockOSVResponseWithPagination: OSVBatchResponse = {
    results: [
        {
            vulns: [
                {
                    id: 'GHSA-page1-vuln1',
                    modified: '2021-05-06T12:00:00Z'
                }
            ],
            next_page_token: 'token123'
        },
        { vulns: [] },
        { vulns: [] }
    ]
};

export const mockOSVPaginatedResponse: OSVBatchResponse = {
    results: [
        {
            vulns: [
                {
                    id: 'GHSA-page2-vuln1',
                    modified: '2021-06-06T12:00:00Z'
                },
                {
                    id: 'GHSA-page2-vuln2',
                    modified: '2021-07-06T12:00:00Z'
                }
            ]
        }
    ]
};

// Helper functions
export function mockFetch(response: any, ok = true, status = 200) {
    return jest.fn().mockResolvedValue({
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: jest.fn().mockResolvedValue(response)
    });
}

export function mockFetchError(error: string) {
    return jest.fn().mockRejectedValue(new Error(error));
}

// File system mocks
type MockEntry = { match: string; type: 'file' | 'directory'; content?: string };

export function createMockFS() {
    const store: MockEntry[] = [];

    const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/^\/+/, '/');

    const findEntry = (filePath: string): MockEntry | undefined => {
        const normalized = normalizePath(filePath);
        for (let i = store.length - 1; i >= 0; i--) {
            if (normalized === store[i].match) {
                return store[i];
            }
        }
        return undefined;
    };

    return {
        __store: store,
        readFile: jest.fn(async (filePath: string) => {
            const entry = findEntry(filePath);
            if (entry && entry.type === 'file' && entry.content !== undefined) {
                return entry.content;
            }
            throw new Error('File not found');
        }),
        readdir: jest.fn(),
        access: jest.fn(async (filePath: string) => {
            const entry = findEntry(filePath);
            if (!entry) {
                throw new Error('File not found');
            }
        }),
        stat: jest.fn(async (filePath: string) => {
            const entry = findEntry(filePath);
            if (!entry) {
                throw new Error('File not found');
            }
            return {
                isDirectory: () => entry.type === 'directory',
                isFile: () => entry.type === 'file'
            };
        }),
        realpath: jest.fn(async (targetPath: string) => targetPath)
    };
}

export function mockFileExists(mockFS: any, path: string, content?: string, type?: 'file' | 'directory') {
    const entryType: 'file' | 'directory' = type ?? (content !== undefined ? 'file' : 'directory');
    const store = mockFS.__store as MockEntry[];
    const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '/');
    store.push({ match: normalized, type: entryType, content });
}

export function mockFileNotExists(mockFS: any, path: string) {
    const store = mockFS.__store as MockEntry[];
    const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '/');
    for (let i = store.length - 1; i >= 0; i--) {
        if (store[i].match === normalized) {
            store.splice(i, 1);
        }
    }
}
