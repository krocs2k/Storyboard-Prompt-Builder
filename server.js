#!/usr/bin/env node
// server.js v13 — spawns `next start` for Docker/VPS deployments
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || '3000';

console.log('');
console.log('========================================');
console.log('  SSC server.js v13');
console.log('  Port: ' + port);
console.log('========================================');

// Pre-flight checks
const nextBin = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
const nextDir = path.join(__dirname, '.next');

if (!fs.existsSync(nextBin)) {
  console.error('FATAL: next binary not found at', nextBin);
  process.exit(1);
}
if (!fs.existsSync(nextDir)) {
  console.error('FATAL: .next build directory not found — run `yarn build` first');
  process.exit(1);
}

console.log('Starting Next.js...');

const child = spawn('node', [nextBin, 'start', '-p', port, '-H', '0.0.0.0'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'production' }
});

child.on('error', (err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) console.error('Next.js killed by signal:', signal);
  else if (code !== 0) console.error('Next.js exited with code:', code);
  process.exit(code || 1);
});
