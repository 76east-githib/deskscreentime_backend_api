export type UserRole =
  | 'user'
  | 'company'
  | 'subCompAdmin'
  | 'client'
  | 'superAdmin'
  | string;

export interface JwtUserPayload {
  userId: string;
  _id?: string;
  email: string;
  fullname?: string;
  role?: UserRole;
  companyId?: string | null;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest {
  user?: JwtUserPayload;
}

// Backward-compatible types used by migrated controllers.
export interface CustomUser {
  _id?: string;
  userId?: string;
  email?: string;
  fullname?: string;
  role?: UserRole;
  companyId?: string | null;
  [key: string]: unknown;
}

export interface CustomSession {
  user?: CustomUser;
  expires?: string;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}
