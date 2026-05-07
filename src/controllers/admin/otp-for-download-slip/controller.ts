import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from "@models/User";
import connectDB from "@database/connect-db";
import { sendEmail } from "@helpers/sendMail";
import { otpHtml } from "@helpers/mailHtml";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  const { userId } = req.body;
  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000);
    const result = await User.findOneAndUpdate(
      { _id: userId },
      { slipOtp: otpCode },
      { new: true }
    );
    if (!result) {
      return res.status(200).json({
        success: false,
        message: "It seems, email is not registered or account is not active",
      });
    }
    const EmailData = otpHtml
      .replace(/#fullName#/g, result?.fullname ?? "User")
      .replace(/#otp#/g, otpCode.toString());
    await sendEmail("OTP Verification", result.email, EmailData);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
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
