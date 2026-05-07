import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from "@database/connect-db";
import mongoose from "mongoose";
import Salary from "@models/Salary";
import User from "@models/User";
import helpers from "@helpers/helpers";
import { sendEmail } from "@helpers/sendMail";
import { salaryHtml } from "@helpers/mailHtml";

// Define the expected request body shape
interface SalaryRequestBody {
  _id?: string;
  userId?: string;
  date: Date | null;
  calculatedSalary: number;
  casualLeave: number;
  paidLeave: number;
  unpaidLeave: number;
  security: number;
  advanceLoan: number;
  ESIC: number;
  PF: number;
}

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    // Ensure the request body has the correct type
    const {
      _id,
      userId,
      date,
      calculatedSalary,
      casualLeave,
      paidLeave,
      unpaidLeave,
      security,
      advanceLoan,
      ESIC,
      PF,
    }: SalaryRequestBody = req.body;

    if (!userId || !date) {
      return res.status(400).json({
          success: false,
          message: "User Id and Date are required.",
        });
    }

    const encryptedSalary = helpers.encryptData(calculatedSalary.toString());

    // Create the salary object
    const salary = {
      userId,
      receivedSalary: {
        salary: encryptedSalary,
        date,
        casualLeave,
        paidLeave,
        unpaidLeave,
        security,
        advanceLoan,
        ESIC,
        PF,
      },
    };

    // Edit case
    if (_id) {
      const updateSalary = await Salary.updateOne(
        { _id: new mongoose.Types.ObjectId(_id) },
        { $set: { ...salary } }
      );

      if (updateSalary.modifiedCount > 0) {
        return res.status(200).json({
            success: true,
            message: `Salary updated successfully.`,
            data: updateSalary,
          });
      } else {
        return res.status(404).json({
            success: false,
            message: "Salary not found or no changes made.",
          });
      }
    }

    // Check if the salary already exists
    const salaryFound = await Salary.find({
      userId,
      "receivedSalary.date": date,
    });

    if (salaryFound.length) {
      return res.status(409).json({
          success: false,
          message: "Salary already exists for the month.",
        });
    }

    // Create new salary
    const salaryCreated = await Salary.create(salary);
    const user = await User.findById(userId);

    if (user) {
      const emailContent = salaryHtml
        .replace("#fullName#", user.fullname)
        .replace(
          "#month#",
          new Date(date).toLocaleString("default", { month: "long", year: "numeric" })
        )
        .replace("#salary#", calculatedSalary.toString());

      // Send email to the user
      sendEmail("Your Salary Details", user.email, emailContent);
    }

    return res.status(201).json({
        success: true,
        message: "Salary created successfully.",
        data: salaryCreated,
      });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
        success: false,
        message: "Server encountered an error.",
      });
  }
});