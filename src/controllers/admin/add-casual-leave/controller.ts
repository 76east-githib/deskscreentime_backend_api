import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from "@database/connect-db";
import User from "@models/User";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const currentYear = new Date().getFullYear();
    const allUsers = await User.find({ role: "user" });
    console.log('updating casual leaves for currentYear',currentYear);
    console.log('total users to update',allUsers.length);

    for (const user of allUsers) {
      const existingYearRecordIndex = user.leaves.findIndex(
        (leave: any) => leave.year === currentYear
      );
      console.log('user',user.fullname,'Found Record:', existingYearRecordIndex !== -1 ? 'Yes' : 'No');
      if (existingYearRecordIndex !== -1) {
        user.leaves[existingYearRecordIndex].casualLeaves += 4;
      } else {
        user.leaves.push({
          year: currentYear,
          casualLeaves: 4,
          paidLeaves: 6,
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