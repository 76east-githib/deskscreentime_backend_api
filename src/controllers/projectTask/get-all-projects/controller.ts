import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from "@models/Project";
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    let { companyId } = req.body;
    let allProjects = await Project.find({ companyId: companyId });
    return res.status(200).json({ success: true, data: allProjects });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable To Get Tasks" });
  }
});
