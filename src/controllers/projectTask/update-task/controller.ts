import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from "@models/Task";
import connectDB from "@database/connect-db";
import mongoose from "mongoose";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  var {
    _id,
    prId,
    taskName,
    taskDescription,
    priority,
    startDate,
    endDate,
    hours,
    actualHours,
    taskStatus,
    userIds,
  } = req.body;
  if (_id) {
    try {
      let data = {
        projectId: prId,
        taskName: taskName,
        taskDescription: taskDescription,
        priority: priority,
        startTime: startDate,
        endTime: endDate,
        hours: hours,
        actualHours:actualHours,
        taskStatus: taskStatus,
        userIds: userIds,
      };
      let updateTask = await Task.updateOne(
        { _id: new mongoose.Types.ObjectId(_id) },
        { $set: data }
      );

      if (updateTask) {
        return res.status(200).json({
            success: true,
            message: "Task Updated Successfully!",
          });
      } else {
        return res.status(500).json({
            success: false,
            message: "The task has not updated.",
          });
      }
    } catch (error) {
      return res.status(500).json({
          success: false,
          message: "Something went wrong, please try again later",
          error,
        });
    }
  } else {
    return res.status(400).json({ success: false, message: "Id is required" });
  }
});
