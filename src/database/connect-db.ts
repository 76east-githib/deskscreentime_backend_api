import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../logging/logger';

let connectionPromise: Promise<typeof mongoose> | null = null;
let isConnecting = false;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (mongoose.connection.readyState === 2 || isConnecting) {
    if (connectionPromise) return connectionPromise;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
      mongoose.connection.once('connected', () => {
        clearTimeout(timeout);
        resolve(mongoose);
      });
      mongoose.connection.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  if (connectionPromise) return connectionPromise;

  if (mongoose.connection.readyState === 0) {
    isConnecting = true;
    logger.info('Initializing database connection...');

    connectionPromise = mongoose
      .connect(env.mongodbUri(), { bufferCommands: false })
      .then((m) => {
        logger.info('Database connected successfully');
        isConnecting = false;
        return m;
      })
      .catch((error) => {
        logger.error('Database connection failed', error);
        connectionPromise = null;
        isConnecting = false;
        throw error;
      });

    return connectionPromise;
  }

  return mongoose;
}

export default connectDB;
