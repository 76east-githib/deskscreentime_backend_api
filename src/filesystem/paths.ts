import path from 'path';
import { env } from '../config/env';

export const screenshotRoot = () => path.resolve(process.cwd(), env.screenshotStorageRoot);
export const extensionScreenshotRoot = () =>
  path.resolve(process.cwd(), env.extensionScreenshotRoot);
