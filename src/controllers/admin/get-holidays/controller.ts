import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Holiday from "@models/Holiday";
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    let result = await Holiday.find({});
    return res.status(200).json({ success: true, result: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable To Get holiday list" });
  }
});
