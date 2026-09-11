const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(
  __dirname,
  'frontend',
  'dist'
);

const BACKEND =
  process.env.BACKEND_TARGET ||
  'http://127.0.0.1:5000';

const PUBLIC_PORT = Number(
  process.env.PORT || 8080
);

const proxy =
  httpProxy.createProxyServer({});

const MIME = {
  '.html':
    'text/html; charset=utf-8',
  '.js':
    'text/javascript; charset=utf-8',
  '.css':
    'text/css; charset=utf-8',
  '.json':
    'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

function sendText(
  res,
  status,
  message
) {
  res.writeHead(status, {
    'Content-Type':
      'text/plain; charset=utf-8',
  });

  res.end(message);
}

function serveStatic(req, res) {
  let urlPath;

  try {
    urlPath = decodeURIComponent(
      req.url.split('?')[0]
    );
  } catch {
    sendText(
      res,
      400,
      'Bad request'
    );
    return;
  }

  // Static frontend only accepts GET/HEAD.
  if (
    req.method !== 'GET' &&
    req.method !== 'HEAD'
  ) {
    res.writeHead(405, {
      Allow: 'GET, HEAD',
      'Content-Type':
        'text/plain; charset=utf-8',
    });

    res.end('Method not allowed');
    return;
  }

  const relativePath =
    urlPath.replace(/^\/+/, '');

  let filePath = path.resolve(
    DIST,
    relativePath
  );

  // Never allow a URL to escape frontend/dist.
  const insideDist =
    filePath === DIST ||
    filePath.startsWith(
      `${DIST}${path.sep}`
    );

  if (!insideDist) {
    sendText(
      res,
      403,
      'Forbidden'
    );
    return;
  }

  try {
    if (
      urlPath === '/' ||
      !fs.existsSync(filePath) ||
      fs.statSync(
        filePath
      ).isDirectory()
    ) {
      // React Router SPA fallback.
      filePath = path.join(
        DIST,
        'index.html'
      );
    }
  } catch {
    filePath = path.join(
      DIST,
      'index.html'
    );
  }

  fs.readFile(
    filePath,
    (err, data) => {
      if (err) {
        console.error(
          'Static file error:',
          err.message
        );

        sendText(
          res,
          404,
          'Not found'
        );

        return;
      }

      const ext = path
        .extname(filePath)
        .toLowerCase();

      const headers = {
        'Content-Type':
          MIME[ext] ||
          'application/octet-stream',
      };

      if (
        filePath.endsWith(
          'index.html'
        ) ||
        ext === '.js' ||
        ext === '.css'
      ) {
        headers['Cache-Control'] =
          'no-store, no-cache, must-revalidate, proxy-revalidate';

        headers.Pragma =
          'no-cache';

        headers.Expires = '0';
      }

      res.writeHead(
        200,
        headers
      );

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      res.end(data);
    }
  );
}

const server =
  http.createServer(
    (req, res) => {
      const pathname =
        req.url.split('?')[0];

      if (
        pathname.startsWith(
          '/api'
        ) ||
        pathname.startsWith(
          '/uploads'
        ) ||
        pathname ===
          '/health' ||
        pathname ===
          '/ready'
      ) {
        proxy.web(
          req,
          res,
          {
            target: BACKEND,
            changeOrigin: true,
          }
        );

        return;
      }

      serveStatic(req, res);
    }
  );

proxy.on(
  'error',
  (err, req, res) => {
    console.error(
      'Proxy error:',
      err.message
    );

    if (!res.headersSent) {
      res.writeHead(502, {
        'Content-Type':
          'application/json; charset=utf-8',
      });
    }

    res.end(
      JSON.stringify({
        error:
          'Backend service unavailable',
      })
    );
  }
);

server.on('error', (err) => {
  console.error(
    'App server error:',
    err
  );

  process.exit(1);
});

server.listen(
  PUBLIC_PORT,
  '0.0.0.0',
  () => {
    console.log(
      `App server running on http://0.0.0.0:${PUBLIC_PORT}`
    );

    console.log(
      '  - Static frontend served from',
      DIST
    );

    console.log(
      `  - Backend proxied to ${BACKEND}`
    );

    console.log(
      '  - Proxy routes: /api, /uploads, /health, /ready'
    );
  }
);