import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from "@models/User";
import connectDB from "@database/connect-db";
import mongoose from "mongoose";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const { alternateTracker, _id } = req.body;
    // Validate input
    if (!_id || typeof alternateTracker !== "string") {
      return res.status(400).json({ success: false, message: "Invalid input data." });
    }

    // Ensure alternateTracker has a valid value
    if (!["USED", "UNUSED"].includes(alternateTracker)) {
      return res.status(400).json({ success: false, message: "Invalid tracker status." });
    }

    // Update user tracker status
    const trackerStatus = await User.updateOne(
      { _id: new mongoose.Types.ObjectId(_id) },
      {
        $set: {
          alternateTracker: alternateTracker === "USED" ? "UNUSED" : "USED",
        },
      }
    );
    // Check if the update was successful
    if (trackerStatus.modifiedCount > 0) {
      return res.status(200).json({
          success: true,
          updateUser: trackerStatus,
          message: `User's tracker status successfully updated to ${
            alternateTracker === "USED" ? "UNUSED" : "USED"
          }.`,
        });
    } else {
      return res.status(500).json({
          success: false,
          message: "No user record was updated. Please try again later.",
        });
    }
  } catch (error) {
    console.error("Error updating tracker status:", error);
    return res.status(500).json({ success: false, message: "An error occurred. Please try again later." });
  }
});
