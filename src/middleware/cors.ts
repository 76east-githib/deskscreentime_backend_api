import cors from 'cors';
import { env } from '../config/env';

export const corsMiddleware = () => {
  const allowed = env.allowedOrigins();
  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowed.length === 0) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-Api-Version',
    ],
  });
};
