import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from '@models/User';
import ScreenShot from '@models/ScreenShot';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';
import { getEndOfDayIST, getStartOfDayIST } from '@utils/dateUtils';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  const { taskId, userId, createdAt } = req.body;
  const startOfISTDay = getStartOfDayIST(createdAt)
  const endOfISTDay = getEndOfDayIST(createdAt)
  try {
    let task = await Task.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(taskId) } },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project'
        }
      },
      { "$unwind": "$project" },
      // First, filter the sessions array by userId
      {
        $addFields: {
          sessions: {
            $filter: {
              input: "$sessions",
              as: "session",
              cond: {
                // $eq: ["$$session.userId", new mongoose.Types.ObjectId(userId)] 
                $and: [
                  {
                    $eq: [ "$$session.userId", new mongoose.Types.ObjectId(userId)]
                  },
                  {
                    $gte: [ "$$session.startTime", new Date(startOfISTDay)]
                  },
                  {
                    $lte: [ "$$session.startTime", new Date(endOfISTDay) ]
                  }
                ]
              }
            }
          }
        }
      },
      // Then calculate the totals using the already filtered sessions
      {
        $addFields: {
          totalMouseClickCount: {
            $sum: {
              $map: {
                input: '$sessions',
                as: 'session',
                in: {
                  $sum: {
                    $map: {
                      input: '$$session.interact',
                      as: 'interact',
                      in: '$$interact.mouseClickCount'
                    }
                  }
                }
              }
            }
          },
          totalKeypressCount: {
            $sum: {
              $map: {
                input: '$sessions',
                as: 'session',
                in: {
                  $sum: {
                    $map: {
                      input: '$$session.interact',
                      as: 'interact',
                      in: '$$interact.keypressCount'
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]);

    // let screen_shots = await ScreenShot.aggregate([
    //   {
    //     '$match': {
    //       taskId: new mongoose.Types.ObjectId(taskId),
    //       $expr: {
    //         $eq: [
    //           { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
    //           { $dateToString: { format: "%Y-%m-%d", date: new Date(createdAt) } }
    //         ]
    //       }
    //     }
    //   },
    //   {
    //     "$group": {
    //       "_id": {
    //         "$dateTrunc": { date: "$createdAt", unit: "minute", binSize: 10 },
    //       },
    //       "obj": {
    //         "$push": { "createdAt": "$createdAt", "imageName": "$imageName", "_id": "$_id", "activeWindow": "$activeWindow" }
    //       }
    //     },
    //   },
    //   {
    //     $unwind: '$obj',
    //   },
    //   {
    //     $sort: {
    //       '_id': 1,
    //     }
    //   },
    //   {
    //     '$group': {
    //       "_id": { "hour": "$_id" },
    //       "grouped_data": { "$push": { "interval": "$_id", "doc": "$obj" } }
    //     }
    //   }
    // ])
    var userDetail = await User.findById(userId)

    let screen_shots = await Task.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(taskId),
        }
      },
      { $unwind: '$sessions' }, // Unwind sessions array
      // old code
      // {
      //   $match: {
      //     $expr: {
      //       $eq: [
      //         { $dateToString: { format: "%Y-%m-%d", date: "$sessions.startTime" } },
      //         { $dateToString: { format: "%Y-%m-%d", date: new Date(createdAt) } }
      //       ]
      //     }
      //   }
      // },
      {
        $match: {
          'sessions.startTime': {
            $gte: startOfISTDay,
            $lte: endOfISTDay
          }
        }
      },
      {
        $lookup: {
          from: 'screenshots',
          let: { sessionStart: '$sessions.startTime', sessionEnd: '$sessions.endTime', taskId: '$_id', userId: '$sessions.userId', createdAt: startOfISTDay },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$taskId', '$$taskId'] },
                    { $eq: ['$userId', '$$userId'] },
                    { $gte: ['$createdAt', '$$sessionStart'] },
                    { $lte: ['$createdAt', '$$sessionEnd'] },
                    // old code
                    // { $eq: [{ $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, { $dateToString: { format: "%Y-%m-%d", date: '$$createdAt' } }] }
                    { $gte: ['$createdAt', startOfISTDay] },
                    { $lte: ['$createdAt', endOfISTDay] }
                  ]
                }
              }
            }
          ],
          as: 'screenshots'
        }
      },
      {
        $project: {
          session: '$sessions',
          screenshots: 1
        }
      },
      { $sort: { '_id': 1 } } // Sort by session ID
    ]);
    return res.status(200).json({ success: true, screen_shots, task, userDetail })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable To Get Notifications' })
  }
});

