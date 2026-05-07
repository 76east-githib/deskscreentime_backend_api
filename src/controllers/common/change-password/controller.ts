import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from '@models/User';
import connectDB from "@database/connect-db";
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB()
  let { id, oldPassword, newPassword } = req.body
  try {
    if (oldPassword && newPassword && id) {
      let userData = await User.findOne({ _id: id })
      
      let isAuthenticated = bcrypt.compareSync(oldPassword, userData.password);
      
      if (isAuthenticated !== false) {
        let salt = bcrypt.genSaltSync(8);
        let pass = bcrypt.hashSync(newPassword, salt);
        let updateUser = await User.updateOne(
          { "_id": new mongoose.Types.ObjectId(id) },
          { $set: { "password": pass } }
        )
        if (updateUser) {
          return res.status(200).json({ success: true, message: 'Password updated successfully.' });
        } else {
          return res.status(200).json({ success: false, message: 'Invalid password' });
        }
      } else {
        return res.status(200).json({ success: false, message: 'Old password mismatched.' });
      }
    } else {
      return res.status(200).json({ success: false, message: `Bad Request, All fields are required` })
    }
  } catch (error) {
    console.log('error', error)
    return res.status(200).json({ success: false, message: 'Something went wrong, please try again later', error })
  }
});