import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';
import { getCurrentIST } from '@utils/dateUtils';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const { taskId, userId, projectId, recordingDuration } = req.body;
    
    if (!taskId || !userId || !projectId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID, User ID, and Project ID are required',
      });
    }

    // Find the task with active session
    const task = await Task.findOne({
      _id: new mongoose.Types.ObjectId(taskId),
      projectId: new mongoose.Types.ObjectId(projectId),
      'sessions.userId': new mongoose.Types.ObjectId(userId),
      'sessions.status': 'active',
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found',
      });
    }

    // Find the active session
    const activeSession = task.sessions.find(
      (session: any) =>
        session.userId &&
        session.userId.toString() === userId &&
        session.status === 'active' &&
        !session.endTime
    );

    if (!activeSession) {
      return res.status(404).json({
        success: false,
        message: 'No active session found',
      });
    }

    // Update the session's lastActiveTime to track the recording progress
    // This helps in tracking corrections and ensures accurate time recording
    // Use IST timezone for consistent time tracking
    const currentTime = getCurrentIST();
    const updateResult = await Task.updateOne(
      {
        _id: new mongoose.Types.ObjectId(taskId),
        'sessions._id': activeSession._id,
      },
      {
        $set: {
          'sessions.$.lastActiveTime': currentTime,
        },
      }
    );

    if (updateResult.modifiedCount > 0) {
      return res.status(200).json({
        success: true,
        message: 'Recording time updated successfully',
        data: {
          taskId,
          recordingDuration,
          lastActiveTime: new Date(),
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to update recording time',
      });
    }
  } catch (error) {
    console.error('Error updating recording time:', error);
    return res.status(500).json({
      success: false,
      message: 'Server encountered an error',
      error: error
    });
  }
});

