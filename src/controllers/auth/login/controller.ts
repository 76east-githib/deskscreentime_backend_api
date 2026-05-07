import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import { getJwtSecret } from '@auth/jwt';
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "@models/User";
// Database connection happens automatically when models are imported
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  // No need to call connectDB() - connection is automatic
  let { email, password } = req.body;
  try {
    if (email && password && email.trim() !== "" && password !== "") {
      email = email.toLowerCase();
      const result = await User.findOne({ email, status: "active" });

      if (result !== null && result !== "" && result !== undefined) {
        if (
          result.email === email &&
          bcrypt.compareSync(password, result.password)
        ) {
          if (result.emailVerification === "pending") {
            return res.status(200).json({
              success: false,
              message: "Email is not verified, please verify your email",
            });
          } else {
            const token = jwt.sign(
              {
                userId: result._id,
                email: result.email,
                fullname: result.fullname,
                role: result.role,
                // role: result.role.map(r => r.name),
                // profile: result.profile
              },
              getJwtSecret(),
              {
                expiresIn: "7 days",
              }
            );
            if (token) {
              return res.status(200).json({
                success: true,
                message: "Authenticated Successfully!",
                token: token,
                role: result.role,
                email: result.email,
                fullname: result.fullname,
                userId: result._id,
                companyId: result.companyId,
              });
            } else {
              return res.status(200).json({
                success: false,
                message:
                  "Internal Server Error, Please try to login after some time",
              });
            }
          }
        } else {
          return res.status(200).json({
            success: false,
            message: "Invalid Credentials",
          });
        }
      } else {
        return res.status(200).json({
          success: false,
          message: `It seems, email is not registered or account is not active`,
        });
      }
    } else {
      return res.status(200).json({
        success: false,
        message: `Bad Request, 'email', 'password' required`,
      });
    }
  } catch (error) {
    console.log("error", error);
    return res.status(200).json({
      success: false,
      message: "Something went wrong, please try again later",
      error,
    });
  }
});
