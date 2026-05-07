import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';
import { getCurrentIST } from '@utils/dateUtils';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const { taskId, userId, projectId } = req.body;
    
    if (!taskId || !userId || !projectId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID, User ID, and Project ID are required',
      });
    }

    const task = await Task.findOne({
      _id: new mongoose.Types.ObjectId(taskId),
      projectId: new mongoose.Types.ObjectId(projectId),
      "sessions.userId": new mongoose.Types.ObjectId(userId)
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task or session not found',
      });
    }

    // Find active session for this user
    const activeSession = task.sessions.find(
      (session: any) =>
        session.userId &&
        session.userId.toString() === userId &&
        session.status === 'active' &&
        !session.endTime
    );

    if (!activeSession) {
      // If no active session, try to update the last session (for recovery)
      const userSessions = task.sessions.filter(
        (session: any) =>
          session.userId && session.userId.toString() === userId
      );

      if (userSessions.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No sessions found for this user',
        });
      }

      const lastSession = userSessions[userSessions.length - 1];
      
      // If last session is still active but not marked, update it
      if (lastSession && !lastSession.endTime) {
        const currentTime = getCurrentIST();
        const updateResult = await Task.updateOne(
          {
            _id: new mongoose.Types.ObjectId(taskId),
            "sessions._id": lastSession._id
          },
          {
            $set: {
              "sessions.$.lastActiveTime": currentTime,
              "sessions.$.status": "active" // Ensure status is active
            }
          }
        );

        if (updateResult.modifiedCount > 0) {
          return res.status(200).json({
            success: true,
            message: "Updated last session's active time (recovered)",
          });
        }
      }

      return res.status(404).json({
        success: false,
        message: 'No active session found to update',
      });
    }

    // Update active session's lastActiveTime using IST
    const currentTime = getCurrentIST();
    const updateResult = await Task.updateOne(
      {
        _id: new mongoose.Types.ObjectId(taskId),
        "sessions._id": activeSession._id
      },
      {
        $set: { "sessions.$.lastActiveTime": currentTime }
      }
    );

    if (updateResult.modifiedCount > 0) {
      return res.status(200).json({
        success: true,
        message: "Updated active session's last active time",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unable to update session - session may have already been closed',
      });
    }
  } catch (error) {
    console.error('Error updating last active time:', error);
    return res.status(500).json({
      success: false,
      message: 'Server encountered an error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});