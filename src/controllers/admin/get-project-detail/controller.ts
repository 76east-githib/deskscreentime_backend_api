import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from "@models/Project";
import User from "@models/User";
import Task from "@models/Task";
import connectDB from "@database/connect-db";
import mongoose from "mongoose";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { page, per_page, startDate, endDate, projectId } = req.body;
  var start = startDate.split("T")[0];
  var end = endDate.split("T")[0];
  let last7date = startDate.split("T")[0];
  try {
    const projectDetail = await Project.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(projectId) },
      },
      {
        $lookup: {
          from: "tasks",
          let: { projectId: "$_id", projectUsers: "$projectTeamIds.value" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$projectId", "$$projectId"] }],
                },
              },
            },
            { $unwind: "$sessions" },
            {
              $match: {
                "sessions.startTime": { $gte: new Date(`${start}T00:00:00.000Z`) },
                "sessions.endTime": { $lte: new Date(`${end.split("T")[0]}T23:59:59.999Z`) },
              },
            },
            {
              $group: {
                _id: "$sessions.userId",
                totalIdleTime: { $sum: "$sessions.idleTime" },
                totalActiveTime: {
                  $sum: {
                    $subtract: ["$sessions.endTime", "$sessions.startTime"],
                  },
                },
                lastWorkedOn: { $max: "$sessions.startTime" },
                startedOn: { $min: "$sessions.startTime" },
              },
            },
          ],
          as: "userTasks",
        },
      },
      {
        $addFields: {
          projectTeam: {
            $map: {
              input: "$projectTeamIds",
              as: "teamMember",
              in: {
                $mergeObjects: [
                  "$$teamMember",
                  {
                    userTasks: {
                      $filter: {
                        input: "$userTasks",
                        as: "task",
                        cond: { $eq: ["$$task._id", "$$teamMember.value"] },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          projectName: 1,
          projectDescription: 1,
          projectTeam: 1,
        },
      },
      { $unwind: "$projectTeam" }, // Ensure each project is not in an array format.
    ]);

    let project_data;
    if (startDate && endDate) {
      project_data = {
        createdAt: {
          $gte: `${start}T00:00:00.000Z`,
          $lt: `${end}T23:59:59.999Z`,
        },
      };
    }
    per_page = per_page ? per_page : 10;
    page = page > 1 ? page : 1;
    // var paginateOptions = {
    //   select: '-__v',
    //   sort: { createdAt: -1 },
    //   lean: true,
    //   page: Number(page),
    //   limit: Number(per_page)
    // }
    // let result = await Project.find(project_data);
    // var meta = {
    //   page: result.page,
    //   total: result.total,
    //   per_page: result.limit,
    //   total_pages: result.pages
    // }
    // var project = result.docs
    return res.status(200).json({ success: true, projectDetail });
  } catch (error) {
    console.log("error form get projects:", error);
    return res.status(500).json({ success: false, message: "Unable To Get Projects" });
  }
});
