import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import AdditionalLeave from "@models/AdditionalLeave";
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
    // Step 1: Find all users with the specified companyId
    const users = await User.find({
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    const userIds = users.map((user) => user._id);

    if (userIds.length === 0) {
      // No users found for the given companyId
      return res.status(200).json({ success: true, project: [], usersData: [], total: 0 });
    }

    // Step 2: Set up query conditions for AdditionalLeave
    let queryAnd: any = [{ userId: { $in: userIds } }];

    // Add current year date range
    const currentYear = new Date().getFullYear();

    const startDate = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${currentYear}-12-31T23:59:59.999Z`);

    queryAnd.push({
      leaveFrom: { $gte: startDate, $lt: endDate },
    });

    // Apply search keyword if provided
    if (searchKeyword && searchKeyword !== "") {
      queryAnd.push({ userId: { $regex: searchKeyword, $options: "i" } });
    }

    const result = await AdditionalLeave.aggregate([
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
        },
      },
      {
        $project: {
          userId: 1,
          leaveFrom: 1,
          leaveTo: 1,
          leaveType: 1,
          remark: 1,
          name: 1,
          createdAt: 1,
          leaveDuration:1,
        },
      },
      { $sort: sort },
      { $skip: query.skip },
      { $limit: query.limit },
    ]);

    // Count the total documents matching the userIds and date range
    const total = await AdditionalLeave.countDocuments({
      userId: { $in: userIds },
      leaveFrom: { $gte: startDate, $lt: endDate },
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
