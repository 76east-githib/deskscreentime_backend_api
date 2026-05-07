import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import ScreenShot from '@models/ScreenShot';
import connectDB from "@database/connect-db";
import mongoose from 'mongoose';
import { compareImages } from '@helpers/compareImage';
import Task from '@models/Task';
import Project from '@models/Project';
import moment from 'moment';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  var { taskId, userId, projectId, screenHeight, screenWidth, interact } = req.body;
  const percentDiffImage = 5
  if (userId && projectId && taskId) {
    try {
      let imageList: any = []

      // get project name based on taskId
      const findProjectName = await Project.findOne({
        _id: new mongoose.Types.ObjectId(projectId)
      });

      // get last 2 screenshot of user for a paticular task
      const findTask = await ScreenShot.find({
        userId: new mongoose.Types.ObjectId(userId),
        taskId: new mongoose.Types.ObjectId(taskId),
        // createdAt: {
        //   '$gte': `${new Date().toISOString().split('T')[0]}T00:00:00.000Z`,
        //   '$lt': `${new Date().toISOString().split('T')[0]}T23:59:59.999Z`
        // }
      }).sort({ "createdAt": -1 }).limit(2);

      // findProjectName.projectName = process.env.NEXT_PUBLIC_ENVIRONMENT == 'dev' ? findProjectName.projectName : findProjectName.projectName.replace(/ /g, "%20")
      // console.log('findProjectName.projectName====:', findProjectName.projectName);

      // process.cwd()/../../../76east/images/screenshots/
      // save location of images in array
      if (findTask && findTask.length == 2) {
        findTask.forEach(item => {
          const dateFolder = moment(item.createdAt).format('YYYYMMDD');
          const basePath = process.env.NEXT_PUBLIC_ENVIRONMENT == 'dev'
            ? `${process.cwd()}/public/screenshots/`
            : `${process.cwd()}/../../76east/images/screenshots/`; // Matched with screen-shot route

          imageList.push(`${basePath}${findProjectName.companyId}/${findProjectName._id}/${dateFolder}/${item.imageName}`);
        });
      }

      // console.log('findTask:', findTask, 'imageList:', imageList);

      let compareImagDiff: any;
      if (imageList && imageList.length) {
        compareImagDiff = compareImages(imageList)
      }
      // console.log('compareImagDiff', compareImagDiff);

      //add/update idle Time for that task
      let startDate = findTask && findTask.length && findTask.length == 2 ? findTask[0] : null
      let endDate = findTask && findTask.length && findTask.length == 2 ? findTask[1] : null
      let milliSecondDiff = startDate && startDate !== '' && endDate && endDate !== '' ? (moment(startDate.createdAt)).diff(moment(endDate.createdAt)) : 0;

      // console.log('startDate:', startDate, 'endDate:', endDate);
      // console.log('milliSecondDiff in seconds:', milliSecondDiff);

      // calculate pixel difference percentage using screenshot dimensions (not user's screen size)
      // old code
      // calculate pixel difference percentage using screenshot dimensions
      const screenshotWidth = compareImagDiff?.width || 0;
      const screenshotHeight = compareImagDiff?.height || 0;
      const screenshotTotalPixels = screenshotWidth * screenshotHeight;

      // Use a slightly more precise percentage calculation for high-res screens
      let imageDiffPixels = compareImagDiff?.diffPixels ?? -1;
      let imageDiffPercent: number = screenshotTotalPixels > 0 && imageDiffPixels >= 0
        ? (imageDiffPixels / screenshotTotalPixels * 100)
        : 100; // Default to 100% diff if error or no pixels found to avoid adding idle time wrongly
      // console.log("imageDiffPercent----56565----",imageDiffPercent);

      // console.log('imageDiffPercent:', imageDiffPercent);
      // console.log('(imageDiffPercent < percentDiffImage):', imageDiffPercent < percentDiffImage)

      // let addUpdateidleTime: any
      // if ((imageDiffPercent == 0 || imageDiffPercent < percentDiffImage)) {

      //   // find old idleTime
      //   let taskDetail = await Task.findById(taskId)
      //   // console.log('taskDetail old idleTime:', taskDetail);
      //   let oldTime = taskDetail.idleTime
      //   if (taskDetail && Object.keys(taskDetail).length !== 0) {
      //     oldTime = oldTime + milliSecondDiff 
      //   }

      //   // console.log('new idle time add:', oldTime);

      //   addUpdateidleTime = await Task.updateOne(
      //     { "_id": new mongoose.Types.ObjectId(taskId) },
      //     { $set: { "idleTime": oldTime } }
      //   )
      // }

      if (imageDiffPercent < percentDiffImage) {
        // Retrieve the task document
        const taskDetail = await Task.findById(taskId);

        if (!taskDetail) {
          return res.status(404).json({ success: false, message: "Task not found." });
        }

        if (!Array.isArray(taskDetail.sessions) || taskDetail.sessions.length === 0) {
          return res.status(400).json({ success: false, message: "No active sessions found for this task." });
        }

        const lastSession = taskDetail.sessions[taskDetail.sessions.length - 1];

        if (startDate && endDate) {
          const sessionStartTime = moment(lastSession.startTime);
          const screenshot1Time = moment(startDate.createdAt);
          const screenshot2Time = moment(endDate.createdAt);

          if (screenshot1Time.isAfter(sessionStartTime) && screenshot2Time.isAfter(sessionStartTime)) {
            lastSession.idleTime += milliSecondDiff;
            if (interact && Object.keys(interact).length > 0) {
              lastSession.interact.push(interact);
            }
            await taskDetail.save();
          }
        }
      }

      // console.log('addUpdateidleTime', addUpdateidleTime);

      return res.status(200).json({
        success: true,
      })
    } catch (error) {
      console.log('error===', error)
      return res.status(200).json({
        success: true,
        message: 'Server encountered some error',
        error: error
      })
    }
  } else {
    return res.status(400).json({
      success: false,
      message: 'All Fields are required'
    });
  }
});