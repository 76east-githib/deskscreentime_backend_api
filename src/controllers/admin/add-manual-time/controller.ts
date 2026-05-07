import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
// import Task from "@models/Task";
// import Leave from "@models/Leave";
// import User from "@models/User";
// import { NextResponse } from "next/server";
// import connectDB from "@database/connect-db";
// import mongoose from "mongoose";

// export async function POST(req: Request) {
//   await connectDB();
//   const {prId, companyId, selectedTask, prTeamIds, startDate, endDate, comments} = req.body;

//   if (!prId || !companyId || !selectedTask || !prTeamIds || !startDate || !endDate) {
//     return NextResponse.json(
//       { success: false, message: "Missing required fields." },
//       { status: 400 }
//     );
//   }

//   const sessionObject = {
//     userId: prTeamIds[0],
//     startTime: new Date(startDate),
//     endTime: new Date(endDate),
//     status: "ended",
//     isManual: true,
//     comments: comments,
//   };

//   try {
//     const task = await Task.findOne({
//       _id: selectedTask,
//       companyId: companyId,
//       projectId: prId,
//     });

//     if (!task) {
//       return NextResponse.json(
//         { success: false, message: "Task not found." },
//         { status: 404 }
//       );
//     }

//     const updatedSessions = [...task.sessions, sessionObject];

//     updatedSessions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

//     task.sessions = updatedSessions;
//     await task.save();

//     return NextResponse.json(
//       {
//         success: true,
//         message: "Manual time added successfully.",
//       },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("Error adding session:", error);
//     return NextResponse.json(
//       {
//         success: false,
//         message: "Server encountered an error",
//         error: error,
//       },
//       { status: 500 }
//     );
//   }
// }

// Working code when admin enter half day or full day on next day
import mongoose from "mongoose";
import connectDB from "@database/connect-db";
import User from "@models/User";
import Task from "@models/Task";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  const {
    prId,
    companyId,
    selectedTask,
    prTeamIds,
    startDate,
    endDate,
    comments,
  } = req.body;

  if (!prId || !companyId || !selectedTask || !prTeamIds || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  const sessionObject = {
    userId: prTeamIds[0],
    startTime: new Date(startDate),
    endTime: new Date(endDate),
    status: "ended",
    isManual: true,
    comments: comments,
  };

  try {
    const projectUpdated = await Task.findOneAndUpdate(
      { _id: selectedTask, companyId: companyId, projectId: prId },
      { $push: { sessions: sessionObject } },
      { returnNewDocument: true, new: true }
    );

    if (!projectUpdated) {
      return res.status(404).json({ success: false, message: "Unable to update task." });
    }

    return res.status(200).json({ success: true, message: "Manual time added successfully." });
  } catch (error) {
    console.log('error:', error)
    return res.status(500).json({ success: false, message: "Server encountered an error", error: error });
  }
});