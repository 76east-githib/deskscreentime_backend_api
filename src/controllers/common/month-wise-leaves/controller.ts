import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Leave from "@models/Leave";
import User from "@models/User";
import mongoose from "mongoose";
import connectDB from "@database/connect-db";

interface LeaveRecord {
  fromDate: Date;
  toDate: Date;
  _id: string;
  dayType?: DayType;
}

interface DayType {
  halfDay: number;
  fullDay: number;
  shortDay: number;
  _id: string;
}

interface LeaveTypes {
  casual: number;
  paid: number;
  unPaid: number;
  _id: string;
}

interface UserLeave {
  casualLeaves: number;
  paidLeaves: number;
  unPaidLeaves: number;
  year: number;
  _id: string;
}

interface UserData {
  userId: mongoose.Types.ObjectId;
  fullname: string;
  leaves: UserLeave[];
  leaveRecords: LeaveRecord[];
  totalUnPaidLeaves: number;
  totalPaidLeaves: number;
  totalCasualLeaves: number;
  totalHalfDay: number;
  totalFullDay: number;
  totalShortDay: number;
  dates: LeaveRecord[];
}

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  const { companyId, selectedMonth, selectedYear, userId } = req.body;
  try {
    const monthMap: { [key: string]: string } = {
      January: "01",
      February: "02",
      March: "03",
      April: "04",
      May: "05",
      June: "06",
      July: "07",
      August: "08",
      September: "09",
      October: "10",
      November: "11",
      December: "12",
    };

    const formattedMonthIndex = parseInt(monthMap[selectedMonth]) - 1;
    const startMonthDate = new Date(Date.UTC(selectedYear, formattedMonthIndex, 1, 0, 0, 0, 0));
    const endMonthDate = new Date(Date.UTC(selectedYear, formattedMonthIndex + 1, 0, 23, 59, 59, 999));

    const userQuery: any = {
      companyId: new mongoose.Types.ObjectId(companyId),
      role: "user",
      "leaves.year": selectedYear,
    };

    if (userId) {
      userQuery._id = new mongoose.Types.ObjectId(userId);
    }

    const users = await User.find(userQuery, { fullname: 1, leaves: 1, role: 1 });

    const results = await Promise.all(
      users.map(async (user) => {
        // Fetch leaves for the user within the specified date range
        const leavesData = await Leave.find({
          userId: user._id,
          "date.fromDate": {
            $gte: startMonthDate,
            $lte: endMonthDate,
          },
        });

        // Initialize counters
        let totalUnPaidLeaves = 0;
        let totalPaidLeaves = 0;
        let totalCasualLeaves = 0;
        let totalHalfDay = 0;
        let totalFullDay = 0;
        let totalShortDay = 0;
        const dates: LeaveRecord[] = [];

        leavesData.forEach((record) => {
          totalUnPaidLeaves += record.leaveTypes[0]?.unPaid || 0;
          totalPaidLeaves += record.leaveTypes[0]?.paid || 0;
          totalCasualLeaves += record.leaveTypes[0]?.casual || 0;
          totalHalfDay += record.dayType[0]?.halfDay || 0;
          totalFullDay += record.dayType[0]?.fullDay || 0;
          totalShortDay += record.dayType[0]?.shortDay || 0;
          record.date.forEach((date: LeaveRecord, index: any) => {
            const enrichedDate = {
              fromDate: date.fromDate,
              toDate: date.toDate,
              _id: date._id,
              dayType: record.dayType?.[index] ?? { halfDay: 0, fullDay: 0, shortDay: 0 },
            };
            dates.push(enrichedDate);          });
        });

        // Return the formatted data for the user
        return {
          userId: user._id,
          fullname: user.fullname,
          leaves: user.leaves.find(
            (leave: any) => leave.year === selectedYear
          ) || { casualLeaves: 0, paidLeaves: 0, unPaidLeaves: 0 },
          leaveRecords: leavesData,
          totalUnPaidLeaves,
          totalPaidLeaves,
          totalCasualLeaves,
          totalHalfDay,
          totalFullDay,
          totalShortDay,
          dates,
        } as UserData;
      })
    );
    return res.status(200).json({
        success: true,
        data: results,
      });
  } catch (error) {
    console.error("Error fetching leave details: ", error);
    return res.status(500).json({ success: false, message: "Unable to get leave details" });
  }
});
