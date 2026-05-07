import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from '@models/Task';
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { userId, page, per_page, selectedDate, projectId, endDate } = req.body
  try {
    var start = selectedDate.split('T')[0]
    var end = endDate.split('T')[0]
    per_page = per_page ? per_page : 10
    page = page > 1 ? page : 1

    var query: any = {
      userId: userId,
      createdAt: {
        '$gte': `${start}T00:00:00.000Z`,
        '$lt': `${end}T23:59:59.999Z`
      }
    }
    if (projectId && projectId !== '') {
      query['projectId'] = projectId
    }

    var paginateOptions = {
      select: '-__v',
      sort: { createdAt: -1 },
      lean: false,
      page: Number(page),
      limit: Number(per_page)
    }

    let result = await Task.find(query);
    return res.status(200).json({ success: true, tasks: result })
  } catch (error) {
    console.log('error', error)
    return res.status(500).json({ success: false, message: 'Unable To Get Task List' })
  }
});

