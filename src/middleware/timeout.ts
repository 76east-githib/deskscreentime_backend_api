import type { NextFunction, Request, Response } from 'express';

/**
 * Hard request timeout. If a handler never writes a response within `ms`,
 * we send a 504 Gateway Timeout so the client never hangs.
 */
export const requestTimeout =
  (ms = 30_000) =>
  (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          message: 'Request timed out',
        });
      }
    }, ms);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
