import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import User from '@models/User';
import Task from '@models/Task';
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { id } = req.body
  try {
    let result = await User.findById(id, { fullname: 1, email: 1, companyName: 1, mobile: 1 });

    return res.status(200).json({ success: true, userData: result })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable To Get user detail' })
  }
});