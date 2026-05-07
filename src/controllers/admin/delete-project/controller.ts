import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import User from '@models/User';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';

export const del = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { id } = req.body
  try {
    let deleteQuery = await Project.deleteOne({ "_id": new mongoose.Types.ObjectId(id) });
    if (deleteQuery) {
      return res.status(200).json({ success: true, deleteQuery })
    } else {
      return res.status(500).json({
        success: false,
        message: 'Unable to delete, please try after some time.'
      })
    }

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable To Delete' })
  }
});

