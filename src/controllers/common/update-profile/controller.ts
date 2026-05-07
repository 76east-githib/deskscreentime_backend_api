import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import { getJwtSecret } from '@auth/jwt';
import User from "@models/User";
import connectDB from "@database/connect-db";
import jwt from "jsonwebtoken";
export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { _id, fullname, email, companyName, mobile } = req.body;
  try {
    if (
      _id &&
      fullname &&
      email &&
      companyName &&
      mobile &&
      fullname.trim() !== "" &&
      email.trim() !== "" &&
      companyName.trim() !== "" &&
      mobile !== ""
    ) {
      const data = {
        email: email,
        fullname: fullname,
        mobile: mobile,
        companyName: companyName,
      };
      let userUpdated = await User.findOneAndUpdate({ _id: _id }, data, {
        returnDocument: "after",
      });
      let token = jwt.sign(
        {
          userId: userUpdated._id,
          email: userUpdated.email,
          fullname: userUpdated.fullname,
          role: userUpdated.role,
        },
        getJwtSecret(),
        {
          expiresIn: "7 days",
        }
      );
      if (userUpdated) {
        return res.status(200).json({
          success: true,
          message: "Profile updated successfully.",
          data: userUpdated,
        });
      } else {
        return res.status(200).json({
          success: false,
          message: "Something went wrong please try again later",
        });
      }
    } else {
      return res.status(200).json({
        success: false,
        message: `Bad Request, All fields are required`,
      });
    }
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: "Something went wrong, please try again later",
      error,
    });
  }
});
