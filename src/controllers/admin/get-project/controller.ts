import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import User from '@models/User';
import Task from '@models/Task';
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { projectId, page, per_page } = req.body
  try {
    per_page = per_page ? per_page : 10
    page = page > 1 ? page : 1

    let result = await Project.findById(projectId);

    return res.status(200).json({ success: true, project: result })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable To Get project detail' })
  }
});

