import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from '@models/User';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { status, id } = req.body
  try {
    if (status && id) {
      let updateUser = await User.updateOne(
        { "_id": new mongoose.Types.ObjectId(id) },
        { $set: { "status": status } }
      )
      if (updateUser) {
        return res.status(200).json({ success: true, updateUser: updateUser, message: `User ${status == 'active' ? 'Activated' : 'Deactivated'} successfully` })
      } else {
        return res.status(500).json({
          success: false,
          message: 'Unable to update, please try after some time.'
        })
      }
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Please try again after sometime.' })
  }
});

