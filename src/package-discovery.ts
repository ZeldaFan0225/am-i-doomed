import fs from 'fs/promises';
import path from 'path';
import { PackageInfo, PackageLockPackageInfo, PackageLockV2V3 } from './types.js';

export class PackageDiscovery {
    private packages: Map<string, PackageInfo> = new Map();
    private packageLockNames: Set<string> = new Set();
    private packageLockMap: Map<string, PackageInfo> = new Map();

    async discoverPackages(projectPath: string, silent = false): Promise<Map<string, PackageInfo>> {
        this.packages.clear();

        // Read package-lock.json first
        await this.readPackageLock(projectPath, silent);

        // Then scan node_modules for additional packages
        await this.readNodeModules(projectPath, silent);

        return this.packages;
    }

    private async readPackageLock(projectPath: string, silent = false): Promise<void> {
        const packageLockPath = path.join(projectPath, 'package-lock.json');

        try {
            const content = await fs.readFile(packageLockPath, 'utf-8');
            const packageLock: PackageLockV2V3 = JSON.parse(content);

            // Extract packages from lockfile v2/v3 format
            if (packageLock.packages) {
                for (const [packagePath, packageInfo] of Object.entries(packageLock.packages)) {
                    if (packagePath === '') continue; // Skip root package

                    const name = packageInfo.name || this.extractNameFromPath(packagePath);
                    const version = packageInfo.version;

                    if (name && version) {
                        this.packages.set(name, {
                            name,
                            version,
                            source: 'package-lock'
                        });
                    }
                }
            }

            // Also check legacy dependencies format (lockfile v1)
            if (packageLock.dependencies) {
                this.extractFromDependencies(packageLock.dependencies);
            }

            // Record names that came from package-lock so node_modules won't overwrite them
            this.packageLockMap = new Map(this.packages);
            this.packageLockNames = new Set(this.packageLockMap.keys());
            if (!silent) console.log(`✅  Read package-lock.json (${this.packages.size} packages)`);
        } catch (error: any) {
            if (!silent) console.log('⚠️  Could not read package-lock.json:', error.message);
        }
    }

    private extractFromDependencies(dependencies: Record<string, PackageLockPackageInfo>, prefix = ''): void {
        for (const [name, info] of Object.entries(dependencies)) {
            const fullName = prefix ? `${prefix}/${name}` : name;
            const version = info.version;

            if (version) {
                this.packages.set(fullName, {
                    name: fullName,
                    version,
                    source: 'package-lock'
                });
            }

            if (info.dependencies) {
                this.extractFromDependencies(info.dependencies, fullName);
            }
        }
    }

    private extractNameFromPath(packagePath: string): string {
        const parts = packagePath.split('/');
        if (parts[1]?.startsWith('@')) {
            return `${parts[1]}/${parts[2]}`;
        }
        return parts[1] || parts[0];
    }

    private async readNodeModules(projectPath: string, silent = false): Promise<void> {
        const nodeModulesPath = path.join(projectPath, 'node_modules');

        try {
            await fs.access(nodeModulesPath);
            const entries = await this.scanNodeModulesRecursively(nodeModulesPath);

            let addedCount = 0;
            for (const entry of entries) {
                // Only add if not already found in package-lock
                const name = entry.name;
                if (this.packageLockNames.has(name)) {
                    // skip packages that were present in package-lock
                    continue;
                }

                if (!this.packages.has(name)) {
                    this.packages.set(name, {
                        name,
                        version: entry.version as any,
                        source: 'node_modules'
                    });
                    addedCount++;
                }
            }

            // Ensure package-lock entries take precedence over any node_modules additions
            for (const [name, info] of this.packageLockMap.entries()) {
                this.packages.set(name, info);
            }

            if (!silent) console.log(`✅  Scanned node_modules (+${addedCount} additional packages)`);
        } catch (error: any) {
            if (!silent) console.log('⚠️  Could not read node_modules:', error.message);
        }
    }

    private async scanNodeModulesRecursively(nodeModulesPath: string): Promise<PackageInfo[]> {
        const packages: PackageInfo[] = [];

        try {
            const entries = await fs.readdir(nodeModulesPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const packagePath = path.join(nodeModulesPath, entry.name);

                    if (entry.name.startsWith('@')) {
                        // Scoped package - need to go one level deeper
                        const scopedEntries = await fs.readdir(packagePath, { withFileTypes: true });
                        for (const scopedEntry of scopedEntries) {
                            if (scopedEntry.isDirectory()) {
                                const scopedPackagePath = path.join(packagePath, scopedEntry.name);
                                const packageInfo = await this.readPackageJson(scopedPackagePath);
                                if (packageInfo) {
                                    packages.push(packageInfo);
                                }
                            }
                        }
                    } else {
                        // Regular package
                        const packageInfo = await this.readPackageJson(packagePath);
                        if (packageInfo) {
                            packages.push(packageInfo);
                        }
                    }
                }
            }
        } catch (error) {
            // Ignore errors for directory scanning
        }

        return packages;
    }

    private async readPackageJson(packagePath: string): Promise<PackageInfo | null> {
        try {
            const packageJsonPath = path.join(packagePath, 'package.json');
            // Normalize separators so tests that mock by substring checks work on Windows
            const normalizedPath = packageJsonPath.replace(/\\/g, '/');
            const content = await fs.readFile(normalizedPath, 'utf-8');
            const packageJson = JSON.parse(content);

            if (packageJson.name && packageJson.version) {
                return {
                    name: packageJson.name,
                    version: packageJson.version,
                    source: 'node_modules'
                };
            }
        } catch (error) {
            // Ignore errors for individual packages
        }

        return null;
    }
}