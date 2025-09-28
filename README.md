# 💀 AM I DOOMED?

"Am I Doomed?" is a lightweight, dramatic-named command-line security scanner for Node.js projects. It queries the OSV (Open Source Vulnerabilities) database to look up known vulnerabilities for the packages discovered in a project and produces a human-friendly report or JSON output.

This README explains how to install, use, and integrate the tool. It also includes an explicit, unambiguous disclaimer about the accuracy of results and the responsibilities of the user.

---

## Table of Contents

- Features
- Installation
- CLI Usage
- Options
- Output and Exporting
- Programmatic API
- Examples
- Troubleshooting
- Development & Testing
- Contributing
- License
- Very Important Disclaimer (Read Carefully)

---

## Features

- Discover packages from a project (package-lock.json and node_modules)
- Query the OSV database for known vulnerabilities
- Print a readable console report
- Export results to a file (text or JSON)
- Lightweight, no external native dependencies

---

## Installation

You can run the tool directly with npx or install it globally:

```bash
# Run without installing
npx am-i-doomed

# Install globally
npm install -g am-i-doomed
am-i-doomed
```

The package targets Node.js >= 16.

---

## CLI Usage

Basic usage:

```bash
# Scan the current directory
npx am-i-doomed

# Scan a specific project path
npx am-i-doomed /path/to/project
```

If run without any arguments, the current working directory is used as the project path.

---

## Options

- `--help`, `-h` — Show help
- `--json`, `-j` — Output results in JSON format (prints JSON to stdout unless `--output` is used)
- `--silent`, `-s` — Suppress console output (useful for CI or scripts; exit codes still indicate status)
- `--output <file>`, `-o <file>` — Save the generated report to a file. If the filename ends with `.json` or `--json` is also used, a JSON report is written. Otherwise a human-readable text report is written.

Notes:
- `--output` supports `--output=path` style and `--output path` style.
- If `--silent` is combined with `--output`, the report will be written but console logging will be suppressed.

---

## Output and Exporting

- Text report: human-friendly, includes summary and per-package entries.
- JSON report: structured data including summary, packages, and vulnerability entries.

Examples:

```bash
# Save text report
npx am-i-doomed --output report.txt

# Save JSON report using --json
npx am-i-doomed --json --output report.json

# Save JSON report by extension (no --json needed)
npx am-i-doomed --output report.json
```

The tool will create output directories if they do not exist. If writing the file fails (permissions, full disk, etc.) a non-fatal error message will be printed unless `--silent` is used.

---

## Programmatic API

You can use the scanner from other Node.js code (it exports ESM-style TypeScript/JS):

```js
import { scanPackage, AmIDoomedScanner } from 'am-i-doomed';

// Simple one-off scan (returns a ScanResult)
const result = await scanPackage('/path/to/project');

// Using the class directly and saving a report file
import { AmIDoomedScanner } from 'am-i-doomed';
const scanner = new AmIDoomedScanner();
await scanner.scanAndReport({
  projectPath: '/path/to/project',
  jsonOutput: true,
  outputPath: '/tmp/my-scan-report.json'
});
```

Types (summary): `ScanOptions` supports `projectPath`, `silent`, `jsonOutput`, and `outputPath`. The `ScanResult` contains a `packages` Map and arrays describing vulnerabilities. See the `src/types.ts` file for exact shapes.

---

## Examples

Run a scan and get a console report:

```bash
npx am-i-doomed
```

Save a report for CI artifacts:

```bash
npx am-i-doomed --json --output ./artifacts/scan-results.json
```

Run silently in a script and check the exit code:

```bash
npx am-i-doomed --silent || echo "Vulnerabilities found"
```

---

## Troubleshooting

- If the tool cannot find packages, ensure you run it in a Node.js project (has a package.json and either package-lock.json or installed node_modules).
- If writing to disk fails, check permissions and available disk space.
- If you receive network errors while querying OSV, retry later; OSV is an external service.

If you need help, open an issue at the repository's issue tracker.

---

## Development & Testing

- Build: `npm run build` (compiles TypeScript)
- Test: `npm test` (runs Jest tests)

The repository includes unit tests that exercise package discovery, OSV client behavior (mocked in tests), the scanner, and report exporting.

---

## Contributing

Contributions are welcome. Open an issue first to discuss significant changes. When submitting PRs, include tests and update the README as needed.

---

## License

This project is provided under the ISC license (see LICENSE file).

---

## Very Important Disclaimer (Read Carefully)

PLEASE READ THIS DISCLAIMER CAREFULLY BEFORE USING THIS SOFTWARE.

- The author and maintainers of "Am I Doomed?" make no representations or warranties about the accuracy, completeness, or usefulness of the information provided by this tool. The tool queries publicly available vulnerability data from the OSV database and attempts to match those entries with packages discovered in a project. This process is inherently heuristic and may produce false positives, false negatives, incomplete results, or stale data.

- UNDER NO CIRCUMSTANCES DOES THE AUTHOR GUARANTEE THAT THE RESULTS ARE ACCURATE OR SUITABLE FOR ANY PARTICULAR PURPOSE. The user is solely responsible for verifying the findings independently and taking any remediation actions.

- This software is provided "AS IS" and the author DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

- IN NO EVENT SHALL THE AUTHOR, CONTRIBUTORS, OR DISTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OF OR INABILITY TO USE THIS SOFTWARE, INCLUDING BUT NOT LIMITED TO LOSS OF REVENUE, PROFITS, DATA, OR GOODWILL.

- You should treat the results as guidance only. When vulnerabilities are reported by this tool, independently verify the details against the upstream sources (for example, the OSV entry), review the affected versions, and validate applicability to your project and runtime configuration before making remediation decisions.

By using this tool you acknowledge and agree to this disclaimer. If you do not agree, do not use the software.

Note: If a scan reports that your project is clean, that result does not guarantee your project has no vulnerabilities — always perform additional validation and review.