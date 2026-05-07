import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from '@models/User';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  const { status, id } = req.body || {};

  if (!status || !id) {
    return res.status(400).json({
      success: false,
      message: "Both 'status' and 'id' are required.",
    });
  }

  try {
    const updateUser = await User.updateOne(
      { $and: [{ _id: new mongoose.Types.ObjectId(id) }, { role: 'company' }] },
      { $set: { status: status } }
    );
    if (updateUser) {
      return res.status(200).json({
        success: true,
        updateUser,
        message: `Company ${status == 'active' ? 'Activated' : 'Deactivated'} successfully`,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Unable to update, please try after some time.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Please try again after sometime.',
    });
  }
});

