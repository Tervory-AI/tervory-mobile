import { readFile } from 'node:fs/promises';

const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (!Array.isArray(report.results) || !Array.isArray(report.errors)) {
  throw new Error('Incomplete Semgrep report');
}
let failed = false;
for (const finding of report.results) {
  const severity = finding.extra?.severity;
  console.log(`${severity}: ${finding.path}:${finding.start.line}: ${finding.check_id}`);
  if (['ERROR', 'HIGH', 'CRITICAL'].includes(severity)) failed = true;
  if (!['INFO', 'WARNING', 'LOW', 'MEDIUM', 'ERROR', 'HIGH', 'CRITICAL'].includes(severity)) failed = true;
}
for (const error of report.errors) {
  console.log(`Semgrep diagnostic: ${error.message}`);
  if (error.level === 'error') failed = true;
}
if (failed) process.exitCode = 1;
