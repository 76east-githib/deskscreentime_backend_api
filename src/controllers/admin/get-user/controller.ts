import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import User from '@models/User';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { userId, companyId } = req.body
  try {

    let userDetail = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: 'projectTeamIds.value',
          as: 'userProject'
        }
      },
      // { "$unwind": "$userProject" },
      {
        $project: {
          userId: "$_id",
          fullName: '$fullname',
          email: '$email',
          mobile: '$mobile',
          role: '$role',
          designation: '$designation',
          address: '$address',
          leaves: '$leaves',
          joiningDate: '$joiningDate',
          bankDetails: '$bankDetails',
          createdAt: '$createdAt',
          userProjects: '$userProject',
        },
      },
    ]);
    return res.status(200).json({ success: true, userDetail })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable To User detail' })
  }
});