import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from "@database/connect-db";
import Task from "@models/Task";
import mongoose from "mongoose";

// Force dynamic rendering to avoid database connections during build
export const get = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    // Get taskId from query string: /api/task/get-task-sessions?taskId=123
    const { searchParams } = new URL(req.originalUrl, `http://${req.get('host') || 'localhost'}`);
    const taskId = searchParams.get("taskId");

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing taskId" });
    }

    // Find task by ID and populate sessions
    const task = await Task.findById(taskId).lean();

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    // Optional: sort sessions by date descending
    if (task.sessions && Array.isArray(task.sessions)) {
      task.sessions.sort(
        (a: any, b: any) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    }

    return res.status(200).json({ success: true, taskId, sessions: task.sessions || [] });
  } catch (error: any) {
    console.error("❌ Error fetching sessions:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching sessions" });
  }
});
