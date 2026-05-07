import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from "@models/Task";
import User from "@models/User";
import connectDB from "@database/connect-db";
import mongoose from "mongoose";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { searchKeyword, sortBy, pageNo, size, prId, fromDate, toDate } =
    req.body;

  pageNo = parseInt(pageNo || 1);
  size = parseInt(size || 10);

  let skip = size * (pageNo - 1);
  let limit = size;

  let sort: any = { createdAt: -1 };
  if (sortBy?.sortColumn) {
    sort = { [sortBy.sortColumn]: sortBy.sortDirection };
  }

  let queryAnd: any = [
    { projectId: new mongoose.Types.ObjectId(prId) }
  ];

  // SEARCH FILTER
  if (searchKeyword) {
    const reg = { $regex: searchKeyword, $options: "i" };
    queryAnd.push({
      $or: [
        { taskName: reg },
        { taskDescription: reg },
        { hours: reg },
        { priority: reg },
        { taskStatus: reg },
      ],
    });
  }

  // DATE RANGE - Use IST timezone
  let start: any = null;
  let end: any = null;

  if (fromDate && toDate) {
    const { getISTDateRangeForQuery } = await import("@utils/dateUtils");
    const startRange = getISTDateRangeForQuery(fromDate);
    const endRange = getISTDateRangeForQuery(toDate);
    start = new Date(startRange.start);
    end = new Date(endRange.end);

    queryAnd.push({
      sessions: {
        $elemMatch: {
          startTime: { $lte: end },
          endTime: { $gte: start },
        },
      },
    });
  }

  try {
    const result = await Task.aggregate([
      { $match: { $and: queryAnd } },

      // Add JS dates into pipeline
      ...(start && end
        ? [
          {
            $addFields: {
              filterStart: start,
              filterEnd: end
            }
          }
        ]
        : []),

      { $sort: sort },
      { $skip: skip },
      { $limit: limit },

      {
        $lookup: {
          from: "users",
          localField: "userIds",
          foreignField: "_id",
          as: "userDetails",
        },
      },

      // Session filter with injected dates
      ...(start && end
        ? [
          {
            $addFields: {
              sessions: {
                $filter: {
                  input: "$sessions",
                  as: "s",
                  cond: {
                    $and: [
                      { $lte: ["$$s.startTime", "$filterEnd"] },
                      { $gte: ["$$s.endTime", "$filterStart"] },
                    ],
                  },
                },
              },
            },
          },
        ]
        : []),

      // Calculate session timings
      {
        $addFields: {
          sessions: {
            $map: {
              input: "$sessions",
              as: "s",
              in: {
                userId: "$$s.userId",
                startTime: "$$s.startTime",
                endTime: "$$s.endTime",
                idleTime: { $ifNull: ["$$s.idleTime", 0] },
                taskDescription: "$$s.taskDescription",
                duration: { $subtract: ["$$s.endTime", "$$s.startTime"] },
                actualMilliseconds: {
                  $subtract: [
                    { $subtract: ["$$s.endTime", "$$s.startTime"] },
                    { $ifNull: ["$$s.idleTime", 0] },
                  ]
                },
                // Merge user info
                userName: {
                  $arrayElemAt: [
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: "$userDetails",
                            as: "u",
                            cond: { $eq: ["$$u._id", "$$s.userId"] }
                          }
                        },
                        as: "u",
                        in: "$$u.fullname"
                      }
                    },
                    0
                  ]
                },
                designation: {
                  $arrayElemAt: [
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: "$userDetails",
                            as: "u",
                            cond: { $eq: ["$$u._id", "$$s.userId"] }
                          }
                        },
                        as: "u",
                        in: "$$u.designation"
                      }
                    },
                    0
                  ]
                }
              }
            }
          }
        }
      },


      { $addFields: { idleTime: { $sum: "$sessions.idleTime" } } },
      { $addFields: { actualHoursMs: { $sum: "$sessions.actualMilliseconds" } } },

      { $addFields: { totalHoursMs: { $add: ["$actualHoursMs", "$idleTime"] } } },

      {
        $addFields: {
          actualHours: {
            $let: {
              vars: {
                totalSec: { $divide: ["$actualHoursMs", 1000] },
              },
              in: {
                $concat: [
                  { $toString: { $floor: { $divide: ["$$totalSec", 3600] } } },
                  "h ",
                  {
                    $toString: {
                      $floor: {
                        $divide: [{ $mod: ["$$totalSec", 3600] }, 60],
                      },
                    },
                  },
                  "m ",
                  {
                    $toString: {
                      $round: [{ $mod: ["$$totalSec", 60] }, 0],
                    },
                  },
                  "s",
                ],
              },
            },
          },
          totalHours: {
            $let: {
              vars: {
                totalSec: { $divide: ["$totalHoursMs", 1000] },
              },
              in: {
                $concat: [
                  { $toString: { $floor: { $divide: ["$$totalSec", 3600] } } },
                  "h ",
                  {
                    $toString: {
                      $floor: {
                        $divide: [{ $mod: ["$$totalSec", 3600] }, 60],
                      },
                    },
                  },
                  "m ",
                  {
                    $toString: {
                      $round: [{ $mod: ["$$totalSec", 60] }, 0],
                    },
                  },
                  "s",
                ],
              },
            },
          },
        },
      },

      {
        $project: {
          _id: 1,
          taskName: 1,
          projectId: 1,
          hours: 1,
          actualHours: 1,
          totalHours: 1,
          idleTime: 1,
          priority: 1,
          taskStatus: 1,
          createdAt: 1,
          updatedAt: 1,

          userNames: {
            $map: {
              input: "$userDetails",
              as: "u",
              in: {
                userId: "$$u._id",
                fullname: "$$u.fullname",
                designation: "$$u.designation"
              }
            },
          },
          sessions: 1,
        },
      },
    ]);

    const total = await Task.countDocuments({ projectId: prId });

    return res.status(200).json({ success: true, data: result, total });
  } catch (error: any) {
    console.error("Task fetch error:", error);
    return res.status(500).json({
        success: false,
        message: "Unable To Get Tasks",
        error: error?.message || error,
      });
  }
});
