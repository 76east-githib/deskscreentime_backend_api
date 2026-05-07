import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from "@models/Task";
import connectDB from "@database/connect-db";
import moment from "moment-timezone";
import { getISTDateRangeForQuery } from "@utils/dateUtils";

const INDIA_TIMEZONE = 'Asia/Kolkata';

export const post = asyncHandler(async (req: Request, res: Response) => {
  try {
    await connectDB();

    // Get today's date range in IST
    const { start, end } = getISTDateRangeForQuery();
    let filter = {
      sessions: {
        $elemMatch: {
          startTime: {
            $gte: start,
            $lt: end,
          },
          status: "active",
        },
      },
    };

    let findRecord = await Task.find(filter);
    let foundArr: any[] = [];

    findRecord.forEach((item) => {
      item.sessions.forEach((session: any) => {
        // Compare using IST timezone
        const now = moment.tz(INDIA_TIMEZONE);
        const lastActive = moment.tz(session.lastActiveTime, INDIA_TIMEZONE);
        if (now.diff(lastActive) >= 600000) { // 10 minutes in milliseconds
          foundArr.push({
            taskId: item._id,
            sessionId: session._id,
            lastActiveTime: session.lastActiveTime,
          });
        }
      });
    });

    if (foundArr.length > 0) {
      for (let foundItem of foundArr) {
        await Task.updateOne(
          { _id: foundItem.taskId, "sessions._id": foundItem.sessionId },
          {
            $set: {
              "sessions.$.status": "crashed",
              "sessions.$.endTime": foundItem.lastActiveTime,
               // ⭐ NEW FUNCTIONALITY — same as stop-task API
              "sessions.$.taskDescriptionStatus": "done",
              taskStatus: "done"
            },
          }
        );
      }
      return res.status(200).json({ success: true, message: "Updated end time for crashed tasks" });
    } else {
      return res.status(200).json({ success: true, message: "No tasks found exceeding the idle time" });
    }
  } catch (error) {
    return res.status(200).json({
        success: true,
        message: "Update-task-time Cron job executed with errors",
        error: error,
      });
  }
});