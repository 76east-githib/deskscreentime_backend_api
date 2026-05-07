import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import ScreenShot from '@models/ScreenShot';
import User from '@models/User';
import Task from '@models/Task';
import Project from '@models/Project';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';

export const del = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { id } = req.body
  try {
    let deleteTasks = await Task.deleteMany({ "userId": new mongoose.Types.ObjectId(id) });
    let deleteScreenshot = await ScreenShot.deleteMany({ "userId": new mongoose.Types.ObjectId(id) });
    let deleteProject = await Project.updateMany({},
      {
        $pull: {
          "projectTeamIds": {
            value: new mongoose.Types.ObjectId(id)
          }
        }
      })

    let deleteUser = await User.deleteOne({ "_id": new mongoose.Types.ObjectId(id) });
    if (deleteScreenshot && deleteTasks && deleteProject && deleteUser) {
      return res.status(200).json({ success: true })
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