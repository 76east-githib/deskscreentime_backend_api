import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { companyId } = req.body
  try {
    let result = await Project.find({ companyId: companyId }).sort({ "createdAt": -1 }).select({ _id: 1, projectName: 1 });
    return res.status(200).json({ success: true, project: result })
  } catch (error) {
    console.log('error form get project list', error)
    return res.status(500).json({ success: false, message: 'Unable To Get Project list' })
  }
});