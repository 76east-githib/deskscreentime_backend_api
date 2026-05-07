import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import User from '@models/User';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';
import { getISTDateRangeForQuery } from "@utils/dateUtils";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { userId, page, per_page, startDate, endDate, projectName } = req.body
  try {
    per_page = per_page ? per_page : 10
    page = page > 1 ? page : 1

    // If dates are ISO strings (contain 'T'), use them directly to respect the exact time/timezone
    // otherwise convert to IST day range to avoid 1-day shifts
    const searchStart = startDate.includes('T') ? startDate : getISTDateRangeForQuery(startDate).start;
    const searchEnd = endDate.includes('T') ? endDate : getISTDateRangeForQuery(endDate).end;

    let query1: any = []
    query1.push(
      {
        $match: {
          userIds: { $in: [new mongoose.Types.ObjectId(userId)] },
          sessions: {
            $elemMatch: {
              userId: new mongoose.Types.ObjectId(userId),
              startTime: { $gte: new Date(searchStart) },
              endTime: { $lte: new Date(searchEnd) }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'projectDetail'
        }
      },
      { $unwind: '$projectDetail' },
      // Add session filtering stage
      {
        $addFields: {
          sessions: {
            $filter: {
              input: "$sessions",
              as: "session",
              cond: {
                $and: [
                  { $eq: ["$$session.userId", new mongoose.Types.ObjectId(userId)] },
                  { $gte: ["$$session.startTime", new Date(searchStart)] },
                  { $lte: ["$$session.endTime", new Date(searchEnd)] }
                ]
              }
            }
          }
        }
      },
      { $sort: { createdAt: -1 } }
    )

    if (projectName && projectName !== '') {
      query1.push(
        {
          $match: { 'projectDetail.projectName': projectName }
        }
      )
    }

    var result1 = await Task.aggregate(query1)

    var userDetail = await User.findById(userId)
    return res.status(200).json({ success: true, tasks: result1, userDetail })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable user report' })
  }
});