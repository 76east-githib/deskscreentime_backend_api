import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
// import { NextResponse } from "next/server";
// import connectDB from "@database/connect-db";
// import mongoose from 'mongoose';
// import ScreenShot from '@models/ScreenShot';
// import Task from "@models/Task";

// export async function POST(req: Request) {
//   await connectDB();
//   const { taskId } = req.body;
//   try {
//     let task = await Task.aggregate([
//       {
//         $lookup: {
//           from: 'projects',
//           localField: 'projectId',
//           foreignField: '_id',
//           as: 'projectDetail'
//         }
//       },
//       {
//         $match: { '_id': new mongoose.Types.ObjectId(taskId) }
//       },
//       { $unwind: '$projectDetail' }
//     ])

//     let screen_shots = await ScreenShot.aggregate([
//       { '$match': { taskId: new mongoose.Types.ObjectId(taskId) } },
//       {
//         "$group": {
//           "_id": {
//             "$dateTrunc": { date: "$createdAt", unit: "minute", binSize: 10 },
//           },
//           "obj": {
//             "$push": { "createdAt": "$createdAt", "imageName": "$imageName", "_id": "$_id" }
//           }
//         },
//       },
//       {
//         $unwind: '$obj',
//       },
//       {
//         $sort: {
//           // specify $sessions sort params here
//           '_id': 1,
//         }
//       },
//       {
//         '$group': {
//           "_id": { "hour": "$_id" },
//           "grouped_data": { "$push": { "interval": "$_id", "doc": "$obj" } }
//         }
//       }
//     ])

//     return NextResponse.json({ success: true, screen_shots: screen_shots, task }, { status: 200 })
//   } catch (error) {
//     console.log('error', error)
//     return NextResponse.json({ success: false, message: 'Unable To Get ScreenShots' }, { status: 500 })
//   }
// }
import { fetchTaskAndScreenshots } from '@helpers/taskScreenShots';

export const post = asyncHandler(async (req: Request, res: Response) => {
  const { taskId, createdAt } = req.body;
  const result = await fetchTaskAndScreenshots(taskId, createdAt);

  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(500).json(result);
  }
});
