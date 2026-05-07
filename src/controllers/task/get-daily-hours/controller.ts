import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';
import moment from 'moment-timezone';
import { getCurrentIST, INDIA_TIMEZONE } from '@utils/dateUtils';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const { userId, month, year } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Get month and year (default to current month/year in IST)
    const currentDate = moment.tz(INDIA_TIMEZONE);
    const selectedMonth = month !== undefined ? parseInt(month) : currentDate.month();
    const selectedYear = year !== undefined ? parseInt(year) : currentDate.year();

    // Get start and end of month in IST
    const startOfMonth = moment.tz([selectedYear, selectedMonth, 1], INDIA_TIMEZONE).startOf('day').toDate();
    const endOfMonth = moment.tz([selectedYear, selectedMonth, 1], INDIA_TIMEZONE).endOf('month').toDate();

    // Find all tasks with sessions for this user in the selected month
    const tasks = await Task.find({
      userIds: new mongoose.Types.ObjectId(userId),
      'sessions.userId': new mongoose.Types.ObjectId(userId),
      'sessions.startTime': {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    }).lean();

    // Group sessions by date
    const dailyHours: { [key: string]: number } = {};
    let totalMonthlyHours = 0;

    tasks.forEach((task: any) => {
      task.sessions?.forEach((session: any) => {
        if (
          session.userId &&
          session.userId.toString() === userId &&
          session.startTime
        ) {
          const sessionDate = moment.tz(session.startTime, INDIA_TIMEZONE);
          
          // Check if session is within the selected month
          if (
            sessionDate.month() === selectedMonth &&
            sessionDate.year() === selectedYear
          ) {
            const dateKey = sessionDate.format('YYYY-MM-DD');
            
            if (!dailyHours[dateKey]) {
              dailyHours[dateKey] = 0;
            }

            // Only count COMPLETED sessions in daily hours
            // Active sessions should not be counted as they're still in progress
            if (session.endTime) {
              // Completed session
              const startTime = new Date(session.startTime);
              const endTime = new Date(session.endTime);
              const sessionDuration = Math.max(0, endTime.getTime() - startTime.getTime()); // Prevent negative durations
              
              // Subtract idle time if available
              const idleTime = session.idleTime || 0;
              const activeTime = Math.max(0, sessionDuration - idleTime); // Ensure non-negative
              
              dailyHours[dateKey] += activeTime;
              totalMonthlyHours += activeTime;
            }
            // Note: Active sessions (status === 'active' && !endTime) are ignored
            // They will be counted once they are completed and have an endTime
          }
        }
      });
    });

    // Convert to formatted hours and create array of daily data
    const dailyData = Object.keys(dailyHours)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => {
        const milliseconds = dailyHours[dateKey];
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return {
          date: dateKey,
          formattedDate: moment.tz(dateKey, INDIA_TIMEZONE).format('DD/MM/YYYY'),
          dayName: moment.tz(dateKey, INDIA_TIMEZONE).format('dddd'),
          milliseconds,
          hours,
          minutes,
          seconds,
          formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        };
      });

    // Calculate total monthly hours
    const totalSeconds = Math.floor(totalMonthlyHours / 1000);
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    const totalSecs = totalSeconds % 60;

    return res.status(200).json({
      success: true,
      data: {
        month: selectedMonth,
        year: selectedYear,
        monthName: moment.months()[selectedMonth],
        dailyData,
        total: {
          milliseconds: totalMonthlyHours,
          hours: totalHours,
          minutes: totalMinutes,
          seconds: totalSecs,
          formatted: `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching daily hours:', error);
    return res.status(500).json({
      success: false,
      message: 'Server encountered an error',
      error: error
    });
  }
});

