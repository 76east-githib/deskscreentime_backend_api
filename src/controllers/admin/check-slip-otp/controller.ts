import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from "@models/User";
import connectDB from "@database/connect-db";
import bcrypt from "bcryptjs";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  const { slipOtp, userId, password } = req.body;
  try {
    if (!slipOtp || !userId || !password) {
      return res.status(200).json({
        success: false,
        message: "Bad Request, All fields are required",
      });
    }
    const user = await User.findOne({ _id: userId, slipOtp: slipOtp });
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "Invalid OTP or User ID",
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(200).json({ success: false, message: "Invalid Password" });
    }
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { slipOtp: 0 },
      { returnDocument: "after" }
    );

    return res.status(200).json({
      success: true,
      message: "OTP is correct",
    });
  } catch (error: any) {
    console.error("Error:", error);
    return res.status(200).json({
      success: false,
      message: "Something went wrong, please try again later",
      error: error.message,
    });
  }
});
