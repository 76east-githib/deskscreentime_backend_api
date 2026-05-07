import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Salary from "@models/Salary";
import connectDB from "@database/connect-db";
import mongoose from "mongoose";

export const del = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { _id } = req.body;
  console.log("_id--->", _id);
  try {
    const existingSalary = await Salary.findById(_id);
    if (!existingSalary) {
      return res.status(404).json({
          success: false,
          message: "No Salary found with the provided ID.",
        });
    }

    let deleteSalary = await Salary.deleteOne({ _id: _id });
    console.log("deleteSalary------>", deleteSalary);
    if (deleteSalary.deletedCount > 0) {
      return res.status(200).json({
        success: true,
        message: "Salary deletion successful.",
        status: 200,
      });
    } else {
      return res.status(404).json({
          success: false,
          message: "No Salary found with the provided ID.",
        });
    }
  } catch (error) {
    console.error("Error deleting salary:", error); // Log the error
    return res.status(500).json({ success: false, message: "Unable To Delete" });
  }
});
