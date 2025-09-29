import fs from 'fs/promises';
import path from 'path';
import { PackageInfo, PackageLockPackageInfo, PackageLockV2V3 } from './types.js';

export class PackageDiscovery {
    private packages: Map<string, PackageInfo> = new Map();
    private packageLockNames: Set<string> = new Set();
    private packageLockMap: Map<string, PackageInfo> = new Map();

    async discoverPackages(projectPath: string, silent = false): Promise<Map<string, PackageInfo>> {
        this.packages.clear();
        this.packageLockNames.clear();
        this.packageLockMap.clear();

        await this.readPackageLock(projectPath, silent);
        await this.readNodeModules(projectPath, silent);

        return this.packages;
    }

    private async readPackageLock(projectPath: string, silent = false): Promise<void> {
        const packageLockPath = path.join(projectPath, 'package-lock.json');

        try {
            const content = await fs.readFile(packageLockPath, 'utf-8');
            const entries = this.parsePackageLockContent(content, packageLockPath, projectPath, 'package-lock');

            for (const entry of entries) {
                this.packages.set(entry.name, entry);
            }

            this.packageLockMap = new Map(this.packages);
            this.packageLockNames = new Set(this.packageLockMap.keys());
            if (!silent) console.log(`Read package-lock.json (${this.packages.size} packages)`);
        } catch (error: any) {
            if (!silent) console.log(`Could not read package-lock.json: ${error.message}`);
        }
    }

    private parsePackageLockContent(
        content: string,
        packageLockPath: string,
        projectPath: string,
        source: 'package-lock' | 'node_modules'
    ): PackageInfo[] {
        const packageLock: PackageLockV2V3 = JSON.parse(content);
        const relativeLockPath = this.toRelativePath(projectPath, packageLockPath) || 'package-lock.json';
        const results: Map<string, PackageInfo> = new Map();

        if (packageLock.packages) {
            for (const [packagePath, packageInfo] of Object.entries(packageLock.packages)) {
                if (packagePath === '') continue;

                const name = packageInfo.name || this.extractNameFromPath(packagePath);
                const version = packageInfo.version;

                if (!name || !version) {
                    continue;
                }

                const reason = this.buildPackageLockPackagesReason(relativeLockPath, packagePath);
                results.set(name, {
                    name,
                    version,
                    source,
                    reason
                });
            }
        }

        if (packageLock.dependencies) {
            this.collectDependenciesFromPackageLock(
                packageLock.dependencies,
                [],
                relativeLockPath,
                source,
                results
            );
        }

        return Array.from(results.values());
    }

    private collectDependenciesFromPackageLock(
        dependencies: Record<string, PackageLockPackageInfo>,
        pathSegments: string[],
        lockPath: string,
        source: 'package-lock' | 'node_modules',
        results: Map<string, PackageInfo>
    ): void {
        for (const [name, info] of Object.entries(dependencies)) {
            const nextSegments = [...pathSegments, name];
            const version = info.version;

            if (version && !results.has(name)) {
                const reason = this.buildPackageLockDependenciesReason(lockPath, nextSegments);
                results.set(name, {
                    name,
                    version,
                    source,
                    reason
                });
            }

            if (info.dependencies) {
                this.collectDependenciesFromPackageLock(
                    info.dependencies,
                    nextSegments,
                    lockPath,
                    source,
                    results
                );
            }
        }
    }

    private buildPackageLockPackagesReason(lockPath: string, packagePath: string): string {
        return `${lockPath} -> packages["${packagePath}"]`;
    }

    private buildPackageLockDependenciesReason(lockPath: string, segments: string[]): string {
        const pointerSegments: string[] = ['dependencies'];
        for (let i = 0; i < segments.length; i++) {
            pointerSegments.push(`"${segments[i]}"`);
            if (i < segments.length - 1) {
                pointerSegments.push('dependencies');
            }
        }

        let pointer = pointerSegments[0];
        for (let i = 1; i < pointerSegments.length; i++) {
            const segment = pointerSegments[i];
            if (segment === 'dependencies') {
                pointer += '["dependencies"]';
            } else {
                pointer += `[${segment}]`;
            }
        }

        return `${lockPath} -> ${pointer}`;
    }

    private extractNameFromPath(packagePath: string): string {
        const normalized = packagePath.replace(/\\/g, '/');
        const marker = 'node_modules/';
        const lastIndex = normalized.lastIndexOf(marker);
        const segment = lastIndex >= 0
            ? normalized.slice(lastIndex + marker.length)
            : normalized;

        if (!segment) {
            return normalized;
        }

        if (segment.startsWith('@')) {
            const [scope, pkg] = segment.split('/');
            return pkg ? `${scope}/${pkg}` : scope;
        }

        const [name] = segment.split('/');
        return name || normalized;
    }

    private async readNodeModules(projectPath: string, silent = false): Promise<void> {
        const nodeModulesPath = path.join(projectPath, 'node_modules');

        try {
            await fs.access(nodeModulesPath);
            const entries = await this.scanNodeModulesRecursively(nodeModulesPath, projectPath);

            let addedCount = 0;
            for (const entry of entries) {
                const name = entry.name;
                if (this.packageLockNames.has(name)) {
                    continue;
                }

                if (!this.packages.has(name)) {
                    this.packages.set(name, { ...entry });
                    addedCount++;
                }
            }

            for (const [name, info] of this.packageLockMap.entries()) {
                this.packages.set(name, info);
            }

            if (!silent) console.log(`Scanned node_modules (+${addedCount} additional packages)`);
        } catch (error: any) {
            if (!silent) console.log(`Could not read node_modules: ${error.message}`);
        }
    }

    private async scanNodeModulesRecursively(
        nodeModulesPath: string,
        projectPath: string,
        visited: Set<string> = new Set()
    ): Promise<PackageInfo[]> {
        const packages: PackageInfo[] = [];

        const canonicalPath = await this.safeRealpath(nodeModulesPath);
        if (canonicalPath) {
            if (visited.has(canonicalPath)) {
                return packages;
            }
            visited.add(canonicalPath);
        }

        let entries;
        try {
            entries = await fs.readdir(nodeModulesPath, { withFileTypes: true });
        } catch {
            return packages;
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            if (entry.name === '.bin') {
                continue;
            }

            const packageRoot = path.join(nodeModulesPath, entry.name);

            if (entry.name.startsWith('@')) {
                let scopedEntries;
                try {
                    scopedEntries = await fs.readdir(packageRoot, { withFileTypes: true });
                } catch {
                    continue;
                }

                for (const scopedEntry of scopedEntries) {
                    if (!scopedEntry.isDirectory()) {
                        continue;
                    }

                    const scopedRoot = path.join(packageRoot, scopedEntry.name);
                    const scopedInfo = await this.readPackageJson(scopedRoot, projectPath);
                    if (scopedInfo) {
                        packages.push(scopedInfo);
                    }

                    const scopedLockEntries = await this.readPackageLockInDirectory(scopedRoot, projectPath);
                    packages.push(...scopedLockEntries);

                    const nestedScopedNodeModules = path.join(scopedRoot, 'node_modules');
                    if (await this.directoryExists(nestedScopedNodeModules)) {
                        packages.push(
                            ...await this.scanNodeModulesRecursively(nestedScopedNodeModules, projectPath, visited)
                        );
                    }
                }

                continue;
            }

            const packageInfo = await this.readPackageJson(packageRoot, projectPath);
            if (packageInfo) {
                packages.push(packageInfo);
            }

            const lockEntries = await this.readPackageLockInDirectory(packageRoot, projectPath);
            packages.push(...lockEntries);

            const nestedNodeModules = path.join(packageRoot, 'node_modules');
            if (await this.directoryExists(nestedNodeModules)) {
                packages.push(
                    ...await this.scanNodeModulesRecursively(nestedNodeModules, projectPath, visited)
                );
            }
        }

        return packages;
    }

    private async readPackageJson(packagePath: string, projectPath: string): Promise<PackageInfo | null> {
        try {
            const packageJsonPath = path.join(packagePath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(content);

            if (packageJson.name && packageJson.version) {
                const relativePath = this.toRelativePath(projectPath, packageJsonPath) || 'package.json';
                return {
                    name: packageJson.name,
                    version: packageJson.version,
                    source: 'node_modules',
                    reason: `package.json -> ${relativePath}`
                };
            }
        } catch {
            // Ignore errors for individual packages
        }

        return null;
    }

    private async readPackageLockInDirectory(directoryPath: string, projectPath: string): Promise<PackageInfo[]> {
        const packageLockPath = path.join(directoryPath, 'package-lock.json');
        if (!(await this.fileExists(packageLockPath))) {
            return [];
        }

        try {
            const content = await fs.readFile(packageLockPath, 'utf-8');
            return this.parsePackageLockContent(content, packageLockPath, projectPath, 'node_modules');
        } catch {
            return [];
        }
    }

    private async directoryExists(targetPath: string): Promise<boolean> {
        try {
            const stats = await fs.stat(targetPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    private async fileExists(targetPath: string): Promise<boolean> {
        try {
            const stats = await fs.stat(targetPath);
            return stats.isFile();
        } catch {
            return false;
        }
    }

    private async safeRealpath(targetPath: string): Promise<string | null> {
        try {
            return await fs.realpath(targetPath);
        } catch {
            return null;
        }
    }


    private toRelativePath(projectPath: string, filePath: string): string {
        const relative = path.relative(projectPath, filePath);
        if (!relative || relative === '') {
            return path.basename(filePath);
        }
        return relative.replace(/\\/g, '/');
    }
}
