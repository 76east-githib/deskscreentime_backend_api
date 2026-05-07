import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Holiday from "@models/Holiday";
import connectDB from "@database/connect-db";
import mongoose from "mongoose";

export const del = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { _id } = req.body;
  console.log("_id--->", _id);
  try {
    const objectId = new mongoose.Types.ObjectId(_id);
    let deleteHoliday = await Holiday.deleteOne({ _id: objectId });
    console.log("deleteHoliday------>", deleteHoliday);
    if (deleteHoliday.deletedCount > 0) {
      return res.status(200).json({
        success: true,
        message: "Holiday deletion successfull",
        status: 200,
      });
    } else {
      return res.status(404).json({
          success: false,
          message: "No holiday found with the provided ID.",
        });
    }
  } catch (error) {
    console.error("Error deleting holiday:", error); // Log the error
    return res.status(500).json({ success: false, message: "Unable To Delete" });
  }
});
