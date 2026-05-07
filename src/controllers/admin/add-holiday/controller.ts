import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from "@database/connect-db";
import mongoose from "mongoose";
import Holiday from "@models/Holiday";

// Define the expected request body shape
interface HolidayRequestBody {
  _id?: string;
  holidayName: string;
  holidayDate: string;
}

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  try {
    // Ensure the request body has the correct type
    const { _id, holidayName, holidayDate }: HolidayRequestBody =
      req.body;

    if (!holidayName || !holidayDate) {
      return res.status(400).json({
          success: false,
          message: "Holiday Name and Holiday Date are required.",
        });
    }

    // Create the holiday object
    const holiday = {
      holidayName,
      holidayDate,
    };

    if (_id) {
      // Update the holiday if an ID is provided
      const updateHoliday = await Holiday.updateOne(
        { _id: new mongoose.Types.ObjectId(_id) },
        { $set: { ...holiday } }
      );

      if (updateHoliday.modifiedCount > 0) {
        return res.status(200).json({
            success: true,
            message: `Holiday updated successfully.`,
            data: updateHoliday,
          });
      } else {
        return res.status(404).json({
            success: false,
            message: "Holiday not found or no changes made.",
          });
      }
    }

    // Check if the holiday already exists
    const holidayFound = await Holiday.findOne({
      holidayName: holidayName,
      holidayDate: holidayDate,
    });

    if (holidayFound) {
      return res.status(409).json({
          success: false,
          message: "Holiday already exists.",
        });
    }

    // Create new holiday
    const holidayCreated = await Holiday.create(holiday);
    return res.status(201).json({
        success: true,
        message: "Holiday created successfully.",
        data: holidayCreated,
      });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
        success: false,
        message: "Server encountered an error.",
      });
  }
});
