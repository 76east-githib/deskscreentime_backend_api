import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from '@models/User';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { projectId } = req.body;

  try {
    const userInProject = await User.aggregate([
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: 'projectTeamIds.value',
          as: 'projects'
        }
      },
      {
        $match: {
          'projects._id': new mongoose.Types.ObjectId(projectId),
          'role': 'user'
        }
      },
      {
        $project: {
          _id: 1,
          fullname: 1,
        }
      }
    ]);

    return res.status(200).json({ success: true, users: userInProject });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to get users by projectId' });
  }
});