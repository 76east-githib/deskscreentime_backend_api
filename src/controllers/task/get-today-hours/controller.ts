import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';
import { getStartOfDayIST, getEndOfDayIST, getCurrentIST } from '@utils/dateUtils';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Get today's date range in IST
    const todayStart = getStartOfDayIST();
    const todayEnd = getEndOfDayIST();

    // Find all tasks with sessions for this user today
    const tasks = await Task.find({
      userIds: new mongoose.Types.ObjectId(userId),
      'sessions.userId': new mongoose.Types.ObjectId(userId),
      'sessions.startTime': {
        $gte: todayStart,
        $lt: todayEnd,
      },
    }).lean();

    // Calculate total time for today
    let totalMilliseconds = 0;
    let activeSessionStartTime: Date | null = null;

    tasks.forEach((task: any) => {
      task.sessions?.forEach((session: any) => {
        // Check if session is for this user and within today
        if (
          session.userId &&
          session.userId.toString() === userId &&
          session.startTime &&
          new Date(session.startTime) >= todayStart &&
          new Date(session.startTime) < todayEnd
        ) {
          if (session.status === 'active' && !session.endTime) {
            // Active session - Add its current duration to total logged time
            const startTime = new Date(session.startTime);
            const now = getCurrentIST();
            const sessionDuration = Math.max(0, now.getTime() - startTime.getTime());
            
            // Note: Total duration included (idle time is NOT subtracted as per requirement)
            totalMilliseconds += sessionDuration;

            // Track the most recent active session for separate return data
            if (!activeSessionStartTime || startTime > activeSessionStartTime) {
              activeSessionStartTime = startTime;
            }
          } else if (session.endTime) {
            // Completed session - add to total logged time
            const startTime = new Date(session.startTime);
            const endTime = new Date(session.endTime);
            const sessionDuration = Math.max(0, endTime.getTime() - startTime.getTime()); // Prevent negative durations
            
            // Note: Total duration included (idle time is NOT subtracted as per requirement)
            totalMilliseconds += sessionDuration;
          }
        }
      });
    });

    // Convert to hours, minutes, seconds
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Calculate active session duration if exists
    let activeSessionDuration = 0;
    if (activeSessionStartTime) {
      const now = getCurrentIST();
      const startTime: Date = activeSessionStartTime;
      const durationMs = now.getTime() - startTime.getTime();
      activeSessionDuration = Math.max(0, Math.floor(durationMs / 1000)); // Prevent negative durations
    }

    return res.status(200).json({
      success: true,
      data: {
        totalMilliseconds,
        hours,
        minutes,
        seconds,
        formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        hasActiveSession: activeSessionStartTime !== null,
        activeSessionStartTime: activeSessionStartTime,
        activeSessionDuration: activeSessionDuration, // Duration in seconds
        activeSessionFormatted: activeSessionDuration > 0 
          ? (() => {
              const hrs = Math.floor(activeSessionDuration / 3600);
              const mins = Math.floor((activeSessionDuration % 3600) / 60);
              const secs = activeSessionDuration % 60;
              return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            })()
          : '00:00:00',
      },
    });
  } catch (error) {
    console.error('Error fetching today hours:', error);
    return res.status(500).json({
      success: false,
      message: 'Server encountered an error',
      error: error
    });
  }
});

