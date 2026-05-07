import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from '@models/Task';
import connectDB from '@database/connect-db';
import mongoose from 'mongoose';
import { getISTDateRangeForQuery } from '@utils/dateUtils';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    let { userId, page, per_page, selectedDate, projectId, endDate } = req.body;
    per_page = per_page || 10;
    page = page > 1 ? page : 1;

    // Get date ranges in IST
    const startRange = getISTDateRangeForQuery(selectedDate);
    const endRange = getISTDateRangeForQuery(endDate);
    
    const startDate = new Date(startRange.start);
    const endOfDay = new Date(endRange.end);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const projectObjectId = projectId ? new mongoose.Types.ObjectId(projectId) : null;

    const pipeline: any[] = [
      {
        $match: {
          'sessions.userId': userObjectId,
          'sessions.startTime': {
            '$gte': startDate,
            '$lt': endOfDay,
          },
        },
      },
      {
        $project: {
          _id: 1,
          projectId: 1,
          title: 1,
          description: 1,
          taskName: 1,
          createdAt: 1,
          updatedAt: 1,
          sessions: {
            $filter: {
              input: '$sessions',
              as: 'session',
              cond: {
                $and: [
                  { $gte: ['$$session.startTime', startDate] },
                  { $lt: ['$$session.startTime', endOfDay] }
                ]
              }
            }
          },
        },
      },
      {
        $sort: { 'sessions.0.startTime': -1 },
      },
      {
        $skip: (page - 1) * per_page,
      },
      {
        $limit: per_page,
      },
    ];

    if (projectObjectId) {
      pipeline[0].$match['projectId'] = projectObjectId;
    }

    const result = await Task.aggregate(pipeline);
    return res.status(200).json({ success: true, tasks: result });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Unable to get task list' });
  }
});