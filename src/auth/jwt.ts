import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export function getJwtSecret(): string {
  return env.jwtSecret();
}

export function signJwt(payload: Record<string, unknown>, options: SignOptions = {}) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: (options.expiresIn || env.jwtExpiresIn) as SignOptions['expiresIn'],
    ...options,
  });
}

export function verifyJwt<T = Record<string, unknown>>(token: string): T {
  return jwt.verify(token, getJwtSecret()) as T;
}

// Backward-compatible aliases used by migrated controllers.
export const signJwtToken = signJwt;
export const verifyJwtToken = verifyJwt;

export function getBearerToken(req: { headers: { authorization?: string } }): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return header.trim();
}
