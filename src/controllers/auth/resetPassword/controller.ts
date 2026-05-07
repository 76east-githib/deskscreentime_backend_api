import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from '@models/User';
import connectDB from "@database/connect-db";
import bcrypt from 'bcryptjs';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB()
  let { email, otp, newpassword } = req.body
  try {
    if (newpassword && email && otp) {

      const result = await User.findOneAndUpdate(
        { email: email, otp: otp }, // filter
        { otp: 0, password: bcrypt.hashSync(newpassword, 10), }, // update array or string
        { returnDocument: "after" }
      )

      if (result !== null && result !== '' && result !== undefined) {
        return res.status(200).json({ success: true, message: 'Password Reset Successfully.' });
      } else {
        return res.status(200).json({ success: false, message: `Invalid OTP` });
      }
    } else {
      return res.status(200).json({ success: false, message: `Bad Request, All fields are required` })
    }
  } catch (error) {
    console.log('error', error)
    return res.status(200).json({ success: false, message: 'Something went wrong, please try again later', error })
  }
});