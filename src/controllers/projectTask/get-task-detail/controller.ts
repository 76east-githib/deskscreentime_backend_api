import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from "@database/connect-db";
import Task from "@models/Task";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { taskId } = req.body;
  try {
    let result = await Task.findById(taskId);
    // console.log("result-->", result);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable To Get project detail" });
  }
});
