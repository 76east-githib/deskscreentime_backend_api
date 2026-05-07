import mongoose from 'mongoose';
import ScreenShot from '@models/ScreenShot';
import Task from "@models/Task";
import connectDB from "@database/connect-db";
import { getEndOfDayIST, getStartOfDayIST } from '@utils/dateUtils';

export async function fetchTaskAndScreenshots(taskId: string, createdAt: string) {
  await connectDB();
  const startOfISTDay = getStartOfDayIST(createdAt)
  const endOfISTDay = getEndOfDayIST(createdAt)

  try {
    // Fetch task details with project details using aggregation
    let task = await Task.aggregate([
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'projectDetail'
        }
      },
      {
        $match: { '_id': new mongoose.Types.ObjectId(taskId) }
      },
      { $unwind: '$projectDetail' },
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

    // Fetch screenshots and group them by 10-minute intervals
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
    // ]);

    let screen_shots = await Task.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(taskId),
        }
      },
      { $unwind: '$sessions' },
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

    return { success: true, screen_shots, task };
  } catch (error) {
    console.error('error', error);
    return { success: false, message: 'Unable To Get ScreenShots' };
  }
}
