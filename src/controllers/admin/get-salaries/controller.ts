import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Salary from "@models/Salary";
import User from "@models/User"; // Ensure you import the User model
import connectDB from "@database/connect-db";
import mongoose from "mongoose";

interface Query {
  skip: number;
  limit: number;
  search: { [key: string]: { $regex: any; $options: string } }[];
}

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { searchKeyword, sortBy, pageNo, size, companyId } = req.body;

  let query: Query = { skip: 0, limit: 10, search: [] };
  let sort: any = { createdAt: -1 };

  // Pagination setup
  if (pageNo || size) {
    pageNo = parseInt(pageNo);
    size = parseInt(size);
    if (pageNo < 1) {
      return res.status(200).json({ success: false, message: "Invalid page number, should start with 1" });
    }
    query.skip = size * (pageNo - 1);
    query.limit = size;
  }

  // Sorting setup
  if (sortBy && sortBy.sortColumn && sortBy.sortDirection) {
    sort = { [sortBy.sortColumn]: sortBy.sortDirection };
  }

  try {
    const users = await User.find({
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    const userIds = users.map((user) => user._id);

    if (userIds.length === 0) {
      return res.status(200).json({ success: true, project: [], usersData: [], total: 0 });
    }


    let queryAnd: any = [{ userId: { $in: userIds } }];

    if (searchKeyword && searchKeyword !== "") {
      queryAnd.push({ userId: { $regex: searchKeyword, $options: "i" } });
    }

    const result = await Salary.aggregate([
      { $match: { $and: queryAnd } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $addFields: {
          name: "$userDetails.fullname",
          date: "$receivedSalary.date",
          salary: "$receivedSalary.salary",
          totalSalary: {
            $ifNull: [{ $arrayElemAt: ["$userDetails.date.salary", 0] }, 0], // Access the salary from the first object in the date array
          },
          casualLeave: "$receivedSalary.casualLeave",
          paidLeave: "$receivedSalary.paidLeave",
          unpaidLeave: "$receivedSalary.unpaidLeave",
          bankDetails: "$userDetails.bankDetails",
          emailId: "$userDetails.email",
          mobile: "$userDetails.mobile",
          security: "$receivedSalary.security",
          advanceLoan: "$receivedSalary.advanceLoan",
          ESIC: "$receivedSalary.ESIC",
          PF: "$receivedSalary.PF",
        },
      },
      {
        $project: {
          userId: 1,
          name: 1,
          casualLeave: 1,
          paidLeave: 1,
          unpaidLeave: 1,
          date: 1,
          salary: 1,
          totalSalary: 1,
          createdAt: 1,
          bankDetails: 1,
          emailId: 1,
          mobile: 1,
          security: 1,
          advanceLoan: 1,
          ESIC: 1,
          PF: 1,
        },
      },
      { $sort: sort },
      { $skip: query.skip },
      { $limit: query.limit },
    ]);

    const total = await Salary.countDocuments({
      userId: { $in: userIds },
    });

    return res.status(200).json({
        success: true,
        result: result,
        total,
      });
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({ success: false, message: "Unable to get projects due to an error." });
  }
});