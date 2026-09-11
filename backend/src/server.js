const path = require('path');
const fs = require('fs');

// Always load backend/.env when running locally.
// Render environment variables still take priority.
require('dotenv').config({
  path: path.join(
    __dirname,
    '../.env'
  ),
});

const config = require('./config');
const logger =
  require('./logging/logger');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const {
  UPLOAD_DIR,
} = require('./utils/upload');

const app = express();

const PORT = config.PORT;

app.set('trust proxy', 1);

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  config.CLIENT_URL
)
  .split(',')
  .map((origin) =>
    origin.trim()
  )
  .filter(Boolean);

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without Origin include curl,
      // internal proxy traffic and some tools.
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      if (
        allowedOrigins.includes(
          origin
        )
      ) {
        return callback(
          null,
          true
        );
      }

      return callback(
        null,
        false
      );
    },

    credentials: true,
  })
);

app.use(
  morgan(
    config.NODE_ENV ===
      'production'
      ? 'combined'
      : 'dev'
  )
);

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

// API responses should always be fresh.
app.use(
  '/api',
  (req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    next();
  }
);

// Receipt files use the exact same
// directory Multer writes to.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    next();
  },
  express.static(UPLOAD_DIR)
);

app.get(
  '/health',
  (req, res) => {
    res.json({
      status: 'ok',
      timestamp:
        new Date().toISOString(),
    });
  }
);

app.get(
  '/ready',
  async (req, res) => {
    try {
      const prisma =
        require('./utils/prisma');

      await prisma.$queryRaw`
        SELECT 1
      `;

      res.json({
        status: 'ok',
        database: 'connected',
      });
    } catch {
      res.status(503).json({
        status: 'unavailable',
        database:
          'disconnected',
      });
    }
  }
);

const authRoutes =
  require('./routes/authRoutes');

const ticketRoutes =
  require('./routes/ticketRoutes');

app.use(
  '/api/auth',
  authRoutes
);

app.use('/api/tickets', ticketRoutes);

// Allows the backend to serve the SPA
// directly if needed.
const FRONTEND_DIST =
  path.join(
    __dirname,
    '..',
    '..',
    'frontend',
    'dist'
  );

if (
  fs.existsSync(
    FRONTEND_DIST
  )
) {
  app.use(
    express.static(
      FRONTEND_DIST
    )
  );

  app.use(
    (req, res, next) => {
      if (
        req.path.startsWith(
          '/api'
        ) ||
        req.path.startsWith(
          '/uploads'
        ) ||
        req.path ===
          '/health' ||
        req.path ===
          '/ready'
      ) {
        return next();
      }

      res.sendFile(
        path.join(
          FRONTEND_DIST,
          'index.html'
        )
      );
    }
  );
} else {
  app.get(
    '/',
    (req, res) => {
      res.json({
        message:
          'Loyalty Program API is running!',
      });
    }
  );
}

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
  });
});

const errorHandler =
  require('./middleware/errorHandler');

app.use(
  (err, req, res, next) => {
    logger.error(
      'request_error',
      {
        message:
          err.message,
        code: err.code,
        path: req.path,
      }
    );

    errorHandler(
      err,
      req,
      res,
      next
    );
  }
);

if (
  require.main === module
) {
  app.listen(
    PORT,
    () => {
      logger.info(
        'server_started',
        {
          port: PORT,
          env:
            config.NODE_ENV,
        }
      );
    }
  );
}

module.exports = app;
