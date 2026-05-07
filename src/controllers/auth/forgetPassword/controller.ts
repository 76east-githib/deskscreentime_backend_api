import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from '@models/User';
import connectDB from "@database/connect-db";
import { sendEmail } from '@helpers/sendMail';
import { htmlForgotPassword } from '@helpers/mailHtml';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB()
  let { email } = req.body
  try {
    if ((email) && (email.trim() !== '')) {
      email = email.toLowerCase();
      let otpCode = Math.floor(Math.random() * 1000000 + 1)
      const result = await User.findOneAndUpdate(
        { email: email, status: 'active' }, // filter
        { otp: otpCode }, // update array or string
        { returnDocument: "after" }
      )
      if (result !== null && result !== '' && result !== undefined) {
        // send otp mail to user
        let otpData = {
          username: result.fullname,
          email: result.email,
          otp: result.otp
        }

        let EmailData: any = htmlForgotPassword.replace(/#fullName#/g, otpData.username)
          .replace(/#email#/g, otpData.email)
          .replace(/#otp#/g, otpData.otp)
        let sentEmail = sendEmail('Reset Password', otpData.email, EmailData)
        return res.status(200).json({ success: true, message: 'Otp sent succesfullly.' });
      } else {
        return res.status(200).json({ success: false, message: `It seems, email is not registered or account is not active` });
      }
    } else {
      return res.status(200).json({ success: false, message: `Bad Request, 'email' required` })
    }
  } catch (error) {
    console.log('error', error)
    return res.status(200).json({ success: false, message: 'Something went wrong, please try again later', error })
  }
});