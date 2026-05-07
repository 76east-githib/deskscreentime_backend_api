import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from "@models/User";
import connectDB from "@database/connect-db";
export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { startDate, endDate } = req.body;
  var start: any, end: any;
  if (startDate && startDate !== "") {
    start = startDate.split("T")[0];
  }
  if (endDate && endDate !== "") {
    end = endDate.split("T")[0];
  }

  let queryAnd: any = [
    { createdAt: { $lt: new Date(`${end}T23:59:59.999Z`) } },
    { role: "company" },
  ];

  if (startDate && startDate !== "") {
    queryAnd.push({ createdAt: { $gte: new Date(`${start}T00:00:00.000Z`) } });
  }

  try {
    let companyList = await User.aggregate([
      { $match: { $and: queryAnd } },
      {
        $lookup: {
          from: "projects",
          localField: "_id",
          foreignField: "companyId",
          as: "projects",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "companyId",
          as: "users",
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          fullname: 1,
          email: 1,
          companyName: 1,
          role: 1,
          status: 1,
          mobile: 1,
          createdAt: 1,
          projectsCount: { $size: "$projects" },
          usersCount: { $size: "$users" },
        },
      },
    ]);

    return res.status(200).json({ success: true, companyList });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable To Get Company List" });
  }
});
