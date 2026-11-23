// Persistent storage for ticket/comment attachments.
//
// Render's filesystem is wiped on every deploy/restart, so in production the
// file bytes go to a PRIVATE Supabase Storage bucket. The browser never talks
// to Supabase: it keeps requesting /uploads/<filename>, and the backend
// streams the object back using the service-role key.
//
// If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (local dev), files
// fall back to the local UPLOAD_DIR exactly as before.
const fs = require('fs/promises');
const path = require('path');
const { UPLOAD_DIR } = require('./upload');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const BUCKET = (process.env.SUPABASE_STORAGE_BUCKET || 'ticket-attachments').trim();

const remoteEnabled = Boolean(SUPABASE_URL && SERVICE_KEY);

// Generated names only: [a-z0-9-] plus a known extension. Anything else is
// rejected before it can reach the filesystem or the storage API.
const SAFE_NAME = /^ticket-\d+-\d+\.[a-z]{2,4}$|^ticket-\d+-\d+$/;

function objectUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeURIComponent(filename)}`;
}

function authHeaders() {
  return { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY };
}

async function saveFile(filename, buffer, mimeType) {
  if (!remoteEnabled) {
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
    return;
  }
  const res = await fetch(objectUrl(filename), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': mimeType, 'x-upsert': 'false' },
    body: buffer,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Attachment upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

async function removeFiles(filenames) {
  const names = filenames.filter((n) => SAFE_NAME.test(n));
  if (!names.length) return;
  if (!remoteEnabled) {
    await Promise.all(names.map((n) => fs.unlink(path.join(UPLOAD_DIR, n)).catch(() => {})));
    return;
  }
  await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: names }),
  }).catch(() => {});
}

// Express handler for GET /uploads/:filename when remote storage is on.
async function serveRemote(req, res, next) {
  const { filename } = req.params;
  if (!SAFE_NAME.test(filename)) return next();
  try {
    const upstream = await fetch(objectUrl(filename), { headers: authHeaders() });
    if (upstream.status === 404 || upstream.status === 400) {
      return res.status(404).json({ message: 'File not found' });
    }
    if (!upstream.ok) {
      return res.status(502).json({ message: 'File storage unavailable' });
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    next(err);
  }
}

module.exports = { remoteEnabled, saveFile, removeFiles, serveRemote, BUCKET };
