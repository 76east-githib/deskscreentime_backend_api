import type { Response } from 'express';

export const apiResponse = {
  success<T>(
    res: Response,
    data?: T,
    message = 'Success',
    status = 200,
    extra: Record<string, unknown> = {}
  ) {
    return res.status(status).json({ success: true, message, data, ...extra });
  },
  error(
    res: Response,
    message = 'Something went wrong',
    status = 500,
    extra: Record<string, unknown> = {}
  ) {
    return res.status(status).json({ success: false, message, ...extra });
  },
};
