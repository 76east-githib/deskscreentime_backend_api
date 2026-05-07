import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
/**
 * Close Inactive Sessions API
 * Automatically closes sessions that have been inactive for more than 30 minutes
 * This handles cases like: power failure, browser crash, internet disconnection
 */
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import { getCurrentIST } from '@utils/dateUtils';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours maximum

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const now = getCurrentIST();
    const timeoutThreshold = new Date(now.getTime() - SESSION_TIMEOUT_MS);
    
    // Find all active sessions
    const tasksWithActiveSessions = await Task.find({
      'sessions.status': 'active',
      'sessions.endTime': null,
    });

    let closedCount = 0;
    let errors: string[] = [];

    for (const task of tasksWithActiveSessions) {
      for (let i = 0; i < task.sessions.length; i++) {
        const session = task.sessions[i];
        
        if (session.status === 'active' && !session.endTime) {
          const startTime = new Date(session.startTime);
          const lastActiveTime = session.lastActiveTime ? new Date(session.lastActiveTime) : startTime;
          const sessionDuration = now.getTime() - startTime.getTime();
          
          // Check if session should be closed due to inactivity
          const isInactive = lastActiveTime < timeoutThreshold;
          
          // Check if session exceeds maximum duration
          const exceedsMaxDuration = sessionDuration > MAX_SESSION_DURATION_MS;
          
          if (isInactive || exceedsMaxDuration) {
            // Use lastActiveTime if available, otherwise use timeout threshold
            let endTime: Date;
            
            if (lastActiveTime && lastActiveTime > startTime) {
              // Use lastActiveTime as end time (when user was last active)
              endTime = lastActiveTime;
            } else {
              // If no lastActiveTime, use startTime + 1 minute as fallback
              // This prevents over-counting for sessions that were never properly updated
              endTime = new Date(startTime.getTime() + 60000); // 1 minute minimum
            }
            
            // Ensure endTime is not in the future
            if (endTime > now) {
              endTime = now;
            }
            
            // Ensure endTime is after startTime
            if (endTime <= startTime) {
              endTime = new Date(startTime.getTime() + 60000);
            }
            
            // Update session
            task.sessions[i].endTime = endTime;
            task.sessions[i].status = 'ended';
            task.sessions[i].taskDescriptionStatus = task.sessions[i].taskDescriptionStatus || 'done';
            
            closedCount++;
          }
        }
      }
      
      if (closedCount > 0) {
        try {
          await task.save();
        } catch (error) {
          errors.push(`Failed to save task ${task._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Closed ${closedCount} inactive session(s)`,
      closedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error closing inactive sessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Server encountered an error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET endpoint to check for inactive sessions (can be called periodically)
export const get = asyncHandler(async (req: Request, res: Response, next) => {
  return post(req, res, next);
});

