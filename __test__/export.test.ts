import { AmIDoomedScanner } from '../src/scanner';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

describe('export/report writing', () => {
    const tmpDir = os.tmpdir();

    test('writes a text report to disk when --output is provided', async () => {
        const outPath = path.join(tmpDir, `amidoomed-test-report-${Date.now()}.txt`);

        const scanner = new AmIDoomedScanner();
        const result = await scanner.scanAndReport({
            projectPath: process.cwd(),
            silent: true,
            jsonOutput: false,
            outputPath: outPath
        });

        expect(fs.existsSync(outPath)).toBe(true);

        const content = fs.readFileSync(outPath, 'utf8');
        expect(content.length).toBeGreaterThan(0);

        // Cleanup
        try { fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
    }, 30000);

    test('writes a JSON report to disk when --json and --output are provided', async () => {
        const outPath = path.join(tmpDir, `amidoomed-test-report-${Date.now()}.json`);

        const scanner = new AmIDoomedScanner();
        const result = await scanner.scanAndReport({
            projectPath: process.cwd(),
            silent: true,
            jsonOutput: true,
            outputPath: outPath
        });

        expect(fs.existsSync(outPath)).toBe(true);

        const content = fs.readFileSync(outPath, 'utf8');
        // Should be valid JSON
        const parsed = JSON.parse(content);
        expect(parsed).toBeDefined();

        // Cleanup
        try { fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
    }, 30000);
});
