import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Invalid email address').toLowerCase().trim();

export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

// User validation schemas
export const registerSchema = z.object({
  fullname: z.string().min(1, 'Full name is required').trim(),
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().min(1, 'Company name is required').trim(),
  mobile: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  _id: objectIdSchema,
  fullname: z.string().min(1, 'Full name is required').trim(),
  email: emailSchema,
  companyName: z.string().min(1, 'Company name is required').trim(),
  mobile: z.string().optional(),
});

// Project validation schemas
export const createProjectSchema = z.object({
  projectName: z.string().min(1, 'Project name is required').trim(),
  companyId: objectIdSchema,
  projectTeamIds: z.array(z.object({
    value: objectIdSchema,
    label: z.string(),
  })).optional(),
  clientId: objectIdSchema.optional(),
});

// Task validation schemas
export const createTaskSchema = z.object({
  taskName: z.string().min(1, 'Task name is required').trim(),
  userId: objectIdSchema.optional(),
  userIds: z.array(objectIdSchema).optional(),
  projectId: objectIdSchema,
  companyId: objectIdSchema,
  priority: z.enum(['low', 'medium', 'high']).optional(),
  taskStatus: z.enum(['todo', 'pending', 'in_progress', 'testing', 'review', 'completed']).optional(),
});

// Leave validation schemas
export const createLeaveSchema = z.object({
  userId: objectIdSchema,
  fromDate: z.string().or(z.date()),
  toDate: z.string().or(z.date()),
  leaveType: z.enum(['casual', 'paid', 'unpaid']),
  leaveDuration: z.enum(['halfleave', 'fullleave']).optional(),
  reason: z.string().optional(),
});

// Holiday validation schemas
export const createHolidaySchema = z.object({
  holidayName: z.string().min(1, 'Holiday name is required').trim(),
  holidayDate: z.string().or(z.date()),
});

// Salary validation schemas
export const createSalarySchema = z.object({
  userId: objectIdSchema,
  date: z.string().or(z.date()),
  calculatedSalary: z.number().min(0),
  casualLeave: z.number().min(0).optional(),
  paidLeave: z.number().min(0).optional(),
  unpaidLeave: z.number().min(0).optional(),
  security: z.number().min(0).optional(),
  advanceLoan: z.number().min(0).optional(),
  ESIC: z.number().min(0).optional(),
  PF: z.number().min(0).optional(),
});

// Helper function to validate request body
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}


