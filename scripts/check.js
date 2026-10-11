// Syntax-checks every JavaScript file in the app. Run with: npm run check
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dirs = ['.', 'src', 'renderer', 'scripts'];
const files = dirs.flatMap((d) =>
  fs
    .readdirSync(path.join(root, d))
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(root, d, f)),
);

for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`checked ${files.length} files`);
