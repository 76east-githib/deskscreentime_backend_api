import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from '@database/connect-db';
import ScreenShot from '@models/ScreenShot';
import Task from '@models/Task';
import Project from '@models/Project';
import { writeFile } from 'fs/promises';
import path from 'path';
import moment from 'moment';
import fs from 'fs';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  const file = req.file as Express.Multer.File | undefined;
  const taskId = req.body?.taskId;
  const userId = req.body?.userId;
  const projectId = req.body?.projectId;
  const companyId = req.body?.companyId;
  const activeWindow = req.body?.activeWindow || '';

  if (!(taskId && userId && file && projectId && companyId)) {
    return res.status(200).json({
      success: false,
      message: 'All Fields are required',
    });
  }

  try {
    const projectDetail = await Project.findById(projectId);
    if (!projectDetail) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const todayDate = moment().format('YYYYMMDD');
    const env = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV;

    const baseDir =
      env === 'prod'
        ? path.join(
            process.cwd(),
            '..',
            '..',
            '76east',
            'images',
            'screenshots',
            String(projectDetail.companyId),
            String(projectDetail._id),
            todayDate
          )
        : path.join(
            process.cwd(),
            'public',
            'screenshots',
            String(projectDetail.companyId),
            String(projectDetail._id),
            todayDate
          );

    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true });
      } catch (error) {
        return res.status(200).json({
          success: false,
          message: 'Server encountered some error',
          error,
        });
      }
    }

    const imageName = Math.random().toString(36).slice(-8) + (file.originalname || 'capture.png');
    await writeFile(path.join(baseDir, imageName), file.buffer);

    const screnShotCreated = await ScreenShot.create({
      taskId,
      userId,
      imageName,
      companyId,
      activeWindow,
    });

    const task = await Task.findById(taskId).select('sessions');
    if (!task || !task.sessions || task.sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid task or sessions found for this taskId.',
      });
    }

    const lastSession = task.sessions[task.sessions.length - 1];
    const lastSessionStartTime = lastSession.startTime;

    const screen_count = await ScreenShot.countDocuments({
      taskId,
      userId,
      createdAt: { $gt: lastSessionStartTime },
    });

    if (screnShotCreated && screen_count) {
      return res.status(200).json({
        success: true,
        message: 'Screen Shot Taken',
        message2: screen_count + ' Screen Shot Taken',
      });
    }
    return res.status(200).json({
      success: false,
      message: 'Unable to add, please try after some time',
    });
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: 'Server encountered some error',
      error,
    });
  }
});
