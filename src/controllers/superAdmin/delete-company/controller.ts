import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import User from '@models/User';
import Task from '@models/Task';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';
import ScreenShot from '@models/ScreenShot';

export const del = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { id } = req.body
  try {
    let deleteScreenShotQuery = await ScreenShot.deleteMany({ "companyId": new mongoose.Types.ObjectId(id) });
    let deleteTaskQuery = await Task.deleteMany({ "companyId": new mongoose.Types.ObjectId(id) });
    let deleteProjectQuery = await Project.deleteMany({ "companyId": new mongoose.Types.ObjectId(id) });
    let delComUser = await User.deleteMany({ $and: [{ 'companyId': new mongoose.Types.ObjectId(id) }, { role: 'user' }] })
    let deleCompany = await User.deleteOne({ $and: [{ _id: new mongoose.Types.ObjectId(id) }, { role: 'company' }] })

    // console.log('deleteScreenShotQuery: ', deleteScreenShotQuery, '\n')
    // console.log('deleteTaskQuery: ', deleteTaskQuery, '\n')
    // console.log('deleteProjectQuery: ', deleteProjectQuery, '\n')
    // console.log('delComUser: ', delComUser, '\n')
    // console.log('deleCompany: ', deleCompany, '\n')

    if (deleteScreenShotQuery && deleteTaskQuery && deleteProjectQuery && delComUser && deleCompany) {
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