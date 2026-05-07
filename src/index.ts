import { connectDB } from '@database/connect-db';
import { createServer } from './server';
import { env } from '@config/env';
import { logger } from '@logging/logger';

async function bootstrap() {
  try {
    // Best-effort initial DB connection; handlers also call connectDB() lazily.
    connectDB().catch((err) =>
      logger.warn('Initial database connection failed; will retry on requests', {
        error: err?.message ?? String(err),
      })
    );

    const app = createServer();
    app.listen(env.port, () => {
      logger.info(`API listening on http://localhost:${env.port}`);
      logger.info(`Swagger UI available at http://localhost:${env.port}/docs`);
      logger.info(`OpenAPI JSON at http://localhost:${env.port}/docs.json`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

bootstrap();
