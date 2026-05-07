import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

export const validate =
  <T>(schema: ZodSchema<T>, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse((req as any)[source]);
    if (!result.success) return next(result.error);
    (req as any)[source] = result.data;
    next();
  };
