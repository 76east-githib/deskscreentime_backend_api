import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from "@database/connect-db";
import User from "@models/User";
import mongoose from "mongoose";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const currentYear = new Date().getFullYear();
    const allUsers = await User.find({});

    for (const user of allUsers) {
      const existingYearRecordIndex = user.leaves.findIndex(
        (leave: any) => leave.year === currentYear
      );
      if (existingYearRecordIndex !== -1) {
        // Update existing leave record for the current year
        user.leaves[existingYearRecordIndex].casualLeaves += 2;
      } else {
        // Add a new leave record for the current year
        user.leaves.push({
          year: currentYear,
          casualLeaves: 2,
          paidLeaves: 6, // Set default values for a new year's leave record
          unPaidLeaves: 0,
        });
      }
      // Save the updated user
      await user.save();
    }

    return res.status(200).json({ message: "Leave records updated successfully" });
  } catch (error) {
    console.error("Error updating leave records:", error);
    return res.status(500).json({ message: "Error updating leave records" });
  }
});
