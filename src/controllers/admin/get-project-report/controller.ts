import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import User from '@models/User';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';
import { getEndOfDayIST, getStartOfDayIST } from '@utils/dateUtils';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { userId, page, per_page, startDate, projectId, endDate } = req.body
  
  const startOfISTDay = getStartOfDayIST(startDate);
  const endOfISTDay = getEndOfDayIST(endDate);

  try {
    per_page = per_page ? per_page : 10
    page = page > 1 ? page : 1

    var query = {
      projectId: new mongoose.Types.ObjectId(projectId),
      "sessions": {
        $elemMatch: {
          "startTime": {
            '$gte': startOfISTDay,
            '$lt': endOfISTDay
          }
        }
      }
    };


    let result = await Task.find(query).sort({ "sessions.startTime": -1 });


    var projectDetail = await Project.aggregate([
      {
        $match: {
          // $and: [
          //   {
          //     createdAt: {
          //       $gte: new Date(`${start}T00:00:00.000Z`)
          //     }
          //   },
          //   {
          //     createdAt: {
          //       $lt: new Date(`${end.split('T')[0]}T23:59:59.999Z`)
          //     }
          //   }
          // ],
          '_id': new mongoose.Types.ObjectId(projectId)
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'projectTeamIds.value',
          foreignField: '_id',
          as: 'userDetail'
        }
      },
      { $sort: { createdAt: -1 } }
    ])

    return res.status(200).json({ success: true, tasks: result, projectDetail })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable To Get Notifications' })
  }
});

