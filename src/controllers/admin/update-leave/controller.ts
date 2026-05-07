import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from "@database/connect-db";
import mongoose from "mongoose";
import Leave from "@models/Leave";
import User from "@models/User";

interface leaveRequestBody {
  _id?: string;
  userId: string;
  dayType: { halfDay: number; fullDay: number; shortDay: number; shortDayConverted?: boolean}[];
  leaveTypes: { casual: number; paid: number; unPaid: number }[];
  date: { "0": { fromDate: string; toDate: string } };
}

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  try {
    const { _id, userId, dayType, leaveTypes, date }: leaveRequestBody =
      req.body;

    if (!_id) {
      return res.status(200).json({ success: false, message: "Leave ID is required." });
    }

    const findLeave = await Leave.findById(_id);
    if (!findLeave) {
      return res.status(200).json({ success: false, message: "Leave not found." });
    }

    if (!Array.isArray(dayType) || !Array.isArray(leaveTypes)) {
      return res.status(200).json({ success: false, message: "dayType and leaveTypes must be arrays." });
    }

    const oldTypes = findLeave.leaveTypes[0];
    const newTypes = leaveTypes[0];

    const casualDiff = newTypes.casual - oldTypes.casual;
    const paidDiff = newTypes.paid - oldTypes.paid;
    const unPaidDiff = newTypes.unPaid - oldTypes.unPaid;

    const updateData: any = {
      dayType,
      leaveTypes,
      date: [{ fromDate: date["0"].fromDate, toDate: date["0"].toDate }],
    };

    await Leave.updateOne({ _id }, { $set: updateData });

    const currentYear = new Date(date["0"].fromDate).getFullYear();
    const user = await User.findById(userId);

    if (user) {
      const yearLeave = user.leaves.find((l: any) => l.year === currentYear);
      if (yearLeave) {
        if (casualDiff !== 0) yearLeave.casualLeaves -= casualDiff;
        if (paidDiff !== 0) yearLeave.paidLeaves -= paidDiff;
        if (unPaidDiff !== 0) yearLeave.unPaidLeaves -= unPaidDiff;
      }
      await user.save();
    }

    return res.status(200).json({ success: true, message: "Leave updated and user balance adjusted." });
  } catch (error) {
    console.error("Error updating leave:", error);
    return res.status(200).json({
        success: false,
        message: "Server error",
        error: (error as Error).message,
      });
  }
});
