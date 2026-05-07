import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { env, isProduction } from '@config/env';
import { corsMiddleware } from '@middleware/cors';
import { errorHandler, notFoundHandler } from '@middleware/error-handler';
import { requestTimeout } from '@middleware/timeout';
import apiRoutes from '@routes/index';
import { buildOpenApiSpec } from '@/docs/swagger';

export function createServer() {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestTimeout(30_000));
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(corsMiddleware());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());
  app.use(compression());
  app.use(
    morgan(isProduction() ? 'combined' : 'dev', {
      skip: (req) => req.path === '/healthz',
    })
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: isProduction() ? 600 : 5000,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/healthz', (_req, res) => {
    res.json({ success: true, message: 'OK', uptime: process.uptime() });
  });

  // Swagger UI for testing every API
  const openApiSpec = buildOpenApiSpec();
  app.get('/docs.json', (_req, res) => res.json(openApiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // All API routes mounted under prefix (default /api)
  app.use(env.apiPrefix, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
