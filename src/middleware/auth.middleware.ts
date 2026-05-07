import type { NextFunction, Request, Response } from 'express';
import { getBearerToken, verifyJwt } from '../auth/jwt';
import type { JwtUserPayload, UserRole } from '../auth/types';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = getBearerToken(req);
  if (!token) return next(new UnauthorizedError('Missing or invalid token'));

  try {
    const payload = verifyJwt<JwtUserPayload>(token);
    req.user = payload;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = getBearerToken(req);
  if (!token) return next();
  try {
    req.user = verifyJwt<JwtUserPayload>(token);
  } catch {
    /* ignore */
  }
  next();
};

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!req.user.role || !roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient role'));
    }
    next();
  };
