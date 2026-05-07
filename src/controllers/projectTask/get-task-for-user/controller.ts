import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from "@models/Task";
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  try {
    const { prId, userId } = req.body;

    if (!prId) {
      return res.status(400).json({ success: false, message: "Project ID and User ID are required" });
    }

    let query;
    if (userId && userId !== '') {
      query = {
        projectId: prId,
        $or: [
          { userIds: { $in: [userId] } },
          { userId }
        ]
      }
    } else {
      query = {
        projectId: prId
      }
    }
    const tasks = await Task.find(query).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({ success: false, message: "Unable to get tasks" });
  }
});