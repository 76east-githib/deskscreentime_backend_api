import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import { getJwtSecret } from '@auth/jwt';
import { getUserData } from '@helpers/getUsersData';
import connectDB from "@database/connect-db";
import jwt from 'jsonwebtoken';  // Assuming you're using JWT for token verification

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  try {
    // Extract the token from the Authorization header
    const authHeader = (req.get('Authorization') || null);
    const token = authHeader?.split(' ')[1]; // Assuming the header is in the format "Bearer <token>"

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token not provided' });
    }

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret()); // Replace with your JWT secret
    } catch (error) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }

    // If token is valid, proceed with the original logic
    const data = req.body;
    const { userInProject, user_duration } = await getUserData(data);

    if (data.startDate && data.endDate) {
      return res.status(200).json({
        success: true, userInProject, user_duration,
      });
    } else {
      return res.status(200).json({ success: true, users: userInProject });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable To Get Notifications' });
  }
});

