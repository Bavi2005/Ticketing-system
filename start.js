const { spawn } = require('child_process');

console.log('Starting EngineDesk services...');

// Start backend internally on port 5000
const backend = spawn(
  process.execPath,
  ['backend/src/server.js'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: '5000',
    },
  }
);

// Start public frontend/proxy server.
// This keeps Render's PORT=8080.
const proxy = spawn(
  process.execPath,
  ['proxy.js'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  }
);

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log('Shutting down EngineDesk services...');

  if (!backend.killed) {
    backend.kill('SIGTERM');
  }

  if (!proxy.killed) {
    proxy.kill('SIGTERM');
  }

  setTimeout(() => {
    process.exit(code);
  }, 500).unref();
}

backend.on('exit', (code, signal) => {
  console.error(
    `Backend exited. code=${code ?? 'null'} signal=${signal ?? 'none'}`
  );

  if (!shuttingDown) {
    shutdown(code || 1);
  }
});

proxy.on('exit', (code, signal) => {
  console.error(
    `Proxy exited. code=${code ?? 'null'} signal=${signal ?? 'none'}`
  );

  if (!shuttingDown) {
    shutdown(code || 1);
  }
});

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
