import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import bcrypt from 'bcryptjs';
import User from '@models/User';
import connectDB from "@database/connect-db";
import { registerSchema, validateRequest } from '@/validation';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  
  try {
    const body = req.body;
    
    // Validate request body
    const validation = validateRequest(registerSchema, body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    const { fullname, email, password, companyName, mobile } = validation.data;

    // Check if user already exists
    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.status(400).json({
        success: false,
        message: 'E-mail already in use'
      });
    }

    // Create new user
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newAccount = await User.create({
      fullname,
      password: hashedPassword,
      email,
      companyName,
      mobile: mobile || undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Account Created Successfully!",
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong, please try again later'
    });
  }
});