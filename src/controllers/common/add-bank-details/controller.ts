import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from "@database/connect-db";
import User from "@models/User";
import mongoose from "mongoose";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  try {
    const { id, fullname, email, mobile, bankDetails } = req.body;

    console.log("Received Request:", { id, fullname, email, mobile, bankDetails });

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      console.log("Invalid or missing User ID");
      return res.status(400).json({ success: false, message: "Invalid or missing User ID" });
    }

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      console.log("User not found in DB");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("Existing User:", existingUser);

    // Create an update object with only provided fields
    let userData: any = {};
    if (fullname !== undefined) userData.fullname = fullname;
    if (email !== undefined) userData.email = email;
    if (mobile !== undefined) userData.mobile = mobile;
    if (bankDetails !== undefined) userData.bankDetails = bankDetails;

    if (Object.keys(userData).length === 0) {
      console.log("No fields to update");
      return res.status(400).json({ success: false, message: "No data provided for update" });
    }

    console.log("Updating user with data:", userData);

    let updatedUser = await User.findByIdAndUpdate(id, userData, { new: true });

    if (!updatedUser) {
      console.log("Failed to update user");
      return res.status(500).json({ success: false, message: "Failed to update user" });
    }

    console.log("Updated User:", updatedUser);

    return res.status(200).json({
        success: true,
        message: "Bank details updated successfully",
        data: {
          id: updatedUser._id,
          fullname: updatedUser.fullname,
          email: updatedUser.email,
          mobile: updatedUser.mobile,
          bankDetails: updatedUser.bankDetails,
        },
      });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("Error in API:", errorMessage);

    return res.status(500).json({ success: false, message: "Server error", error: errorMessage });
  }

});