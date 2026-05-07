import dotenv from 'dotenv';

dotenv.config();

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  apiPrefix: process.env.API_PREFIX || '/api',

  mongodbUri: () => required('MONGODB_URI'),

  jwtSecret: () => required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  allowedOrigins: () =>
    (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),

  smtp: {
    host: process.env.SMTP_HOST || process.env.SMTP_Host,
    port: Number(process.env.SMTP_PORT || process.env.SMTP_Port || 587),
    user: process.env.SMTP_USERNAME || process.env.SMTP_Username,
    pass: process.env.SMTP_PASSWORD || process.env.SMTP_Password,
    from: process.env.SMTP_EMAIL_FROM,
  },

  screenshotStorageRoot: process.env.SCREENSHOT_STORAGE_ROOT || './public/screenshots',
  extensionScreenshotRoot:
    process.env.EXTENSION_SCREENSHOT_ROOT || './public/extensions-screenshot',

  publicImageBaseUrl: process.env.PUBLIC_IMAGE_BASE_URL || '',
  publicUploadUrl: process.env.PUBLIC_UPLOAD_URL || '',

  cryptoEncryptionKey: process.env.CRYPTO_ENCRYPTION_KEY || 'default_secret_key',
} as const;

export const isProduction = () => env.nodeEnv === 'production';
