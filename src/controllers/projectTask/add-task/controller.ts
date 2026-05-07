import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from "@models/Task";
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  const {
    projectId,
    taskName,
    taskDescription,
    priority,
    startDate,
    endDate,
    sessions,
    hours,
    taskStatus,
    companyId,
    userIds
  } = req.body;

  if (projectId && taskName) {
    try {
      const data = {
        projectId,
        taskName,
        taskDescription,
        priority,
        startTime: startDate,
        endTime: endDate,
        sessions,
        hours,
        taskStatus,
        companyId,
        userIds
      };

      const newTask = await Task.create(data);

      return res.status(200).json({
          success: true,
          message: "Task Created Successfully!",
          task: newTask
        });
    } catch (error) {
      return res.status(500).json({
          success: false,
          message: "Something went wrong, please try again later",
          error,
        });
    }
  } else {
    return res.status(400).json({ success: false, message: "projectId and taskName are required" });
  }
});