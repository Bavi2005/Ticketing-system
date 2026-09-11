// Minimal structured JSON logger. No secrets/tokens/passwords may ever be logged.

const config = require('../config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function write(level, msg, meta) {
  if (LEVELS[level] < LEVELS[config.LOG_LEVEL]) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (LEVELS[level] >= LEVELS.error) {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

module.exports = {
  debug: (msg, meta) => write('debug', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};
