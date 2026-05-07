import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import User from '@models/User';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import { getCurrentIST } from '@utils/dateUtils';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  const { taskId } = req.body;

  if (taskId) {
    try {
      const task = await Task.findById(taskId);
      if (task) {
        // Use IST timezone for consistent time tracking
        const currentTime = getCurrentIST();

        // Find the active session for this task
        const activeSessionIndex = task.sessions.findIndex(
          (session: any) => session.status === 'active' && !session.endTime
        );

        if (activeSessionIndex === -1) {
          // If no active session, try to update the last session
          if (task.sessions && task.sessions.length > 0) {
            const lastSession = task.sessions[task.sessions.length - 1];
            if (!lastSession.endTime) {
              lastSession.endTime = currentTime;
              lastSession.status = 'ended';
              if (!lastSession.taskDescriptionStatus || lastSession.taskDescriptionStatus === 'todo') {
                lastSession.taskDescriptionStatus = 'done';
              }
            }
          } else {
            return res.status(400).json({
              success: false,
              message: 'No sessions found to update',
            });
          }
        } else {
          // Update the active session
          const activeSession = task.sessions[activeSessionIndex];
          activeSession.endTime = currentTime;
          activeSession.status = 'ended';
          if (!activeSession.taskDescriptionStatus || activeSession.taskDescriptionStatus === 'todo') {
            activeSession.taskDescriptionStatus = 'done';
          }
        }

        await task.save();

        return res.status(200).json({ success: true, message: "Timer Stopped" });
      } else {
        return res.status(404).json({
          success: false,
          message: 'Unable to find'
        })
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Server encountered some error',
        error: error
      })
    }
  } else {
    // res.sendStatus(400);
    return res.status(400).json({
      success: false,
      message: 'All Fields are required'
    });
  }
});

