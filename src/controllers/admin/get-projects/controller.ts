import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from "@models/Project";
import connectDB from "@database/connect-db";
import mongoose from "mongoose";
import { Console } from "console";
interface Query {
  skip: number;
  limit: number;
  search: { [key: string]: { $regex: any; $options: string } }[];
}

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { startDate, endDate, searchKeyword, sortBy, pageNo, size, companyId } =
    req.body;
  let query: Query = { skip: 0, limit: 10, search: [] };
  let sort: any = { createdAt: -1 };
  if (pageNo || size) {
    pageNo = parseInt(pageNo);
    size = parseInt(size);
    if (pageNo < 0 || pageNo === 0) {
      return res.status(200).json({ success: false, message: `Invalid page number, should start with 1` });
    }
    query.skip = size * (pageNo - 1);
    query.limit = size;
  }

  if (sortBy && sortBy.sortColumn && sortBy.sortDirection) {
    sort = { [sortBy.sortColumn]: sortBy.sortDirection };
  }
  if (searchKeyword && searchKeyword != "") {
    // to search keyword in email and firstName
    query.search.push({
      projectName: { $regex: searchKeyword, $options: "i" },
    });
  }
  var start: any, end: any;
  if (startDate && startDate !== "") {
    start = startDate.split("T")[0];
  }
  if (endDate && endDate !== "") {
    end = endDate.split("T")[0];
  }

  // Build query - only add date filters if dates are provided
  let queryAnd: any = [
    { companyId: new mongoose.Types.ObjectId(companyId) },
  ];

  // Add endDate filter only if provided
  if (end) {
    queryAnd.push({ createdAt: { $lt: new Date(`${end}T23:59:59.999Z`) } });
  }

  if (searchKeyword && searchKeyword != "") {
    // to search keyword in email and firstName
    queryAnd.push({ projectName: { $regex: searchKeyword, $options: "i" } });
  }

  if (startDate && startDate !== "") {
    queryAnd.push({
      createdAt: {
        $gte: new Date(`${start}T00:00:00.000Z`),
      },
    });
  }

  try {
    let project_duration = await Project.aggregate([
      {
        $match: {
          $and: queryAnd,
        },
      },
      {
        $lookup: {
          from: "tasks",
          let: { projectTeamIds: "$projectTeamIds.value", projectId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $setIsSubset: ["$userIds", "$$projectTeamIds"] },
                    { $eq: ["$projectId", "$$projectId"] },
                  ],
                },
              },
            },
            {
              $addFields: {
                sessionDuration: {
                  $sum: {
                    $map: {
                      input: "$sessions",
                      as: "session",
                      in: {
                        $divide: [
                          {
                            $subtract: [
                              "$$session.endTime",
                              "$$session.startTime",
                            ],
                          },
                          1000,
                        ],
                      },
                    },
                  },
                },
                idleTime: { $sum: "$sessions.idleTime" },
                lastSessionCreatedAt: { $max: "$sessions.lastActiveTime" },
              },
            },
          ],
          as: "userTask",
        },
      },
      { $unwind: "$userTask" },
      {
        $project: {
          userId: "$userTask._id",
          projectName: "$projectName",
          projectStatus: "$projectStatus",
          createdAt: "$createdAt",
          projectTeamIds: "$projectTeamIds",
          duration: "$userTask.sessionDuration",
          idleDuration: "$userTask.idleTime",
          userlastWork: "$userTask.lastSessionCreatedAt",
          actualHours: "$userTask.actualHours",
        },
      },
      {
        $group: {
          _id: "$_id",
          totalDuration: { $sum: "$duration" },
          totalIdlDuration: { $sum: "$idleDuration" },
          lastWorkedOn: { $last: "$userlastWork" },
          actualHours: { $sum: "$actualHours" },
        },
      },
    ]);

    let result = await Project.aggregate([
      {
        $match: { $and: queryAnd },
      },
      { $sort: sort },
      { $skip: query.skip },
      { $limit: query.limit },
    ]);

    let total = await Project.find({ companyId: companyId });
    return res.status(200).json({ success: true, project: result, project_duration, total: total.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable To Get Projects" });
  }
});
