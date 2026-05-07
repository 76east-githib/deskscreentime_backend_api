// utils/getUserData.js
import mongoose from 'mongoose';
import Task from '@models/Task';
import User from '@models/User';
interface Query {
  skip: number;
  limit: number;
  search: { [key: string]: { $regex: any; $options: string } }[];
}

export async function getUserData({ startDate, endDate, searchKeyword, sortBy, pageNo, size, companyId, fromPayroll }: any) {
  let query: any = { skip: 0, limit: 10, search: [] };
  let sort: any = { createdAt: -1 };
  // if fromPayroll is true then don't apply pagination
  // this is to work thi API in payroll app
  if (!fromPayroll && (pageNo || size)) {
    pageNo = parseInt(pageNo);
    size = parseInt(size);
    if (pageNo < 0 || pageNo === 0) {
      return { success: false, message: `Invalid page number, should start with 1` };
    }
    query.skip = size * (pageNo - 1);
    query.limit = size;
  }

  if (sortBy && sortBy.sortColumn && sortBy.sortDirection) {
    sort = { [sortBy.sortColumn]: sortBy.sortDirection };
  }

  if (searchKeyword && searchKeyword !== '') {
    query.search.push(
      { email: { $regex: searchKeyword, "$options": "i" } },
      { fullname: { $regex: searchKeyword, "$options": "i" } }
    );
  }

  var last7date;
  if (startDate) {
    last7date = startDate.split('T')[0];
  }

  let user_duration;
  if (startDate && endDate) {
    user_duration = await Task.aggregate([
      {
        $match: {
          $and: [
            { "sessions.startTime": { $gte: new Date(`${last7date}T00:00:00.000Z`) } },
            { "sessions.startTime": { $lt: new Date(`${endDate.split('T')[0]}T23:59:59.999Z`) } },
            { companyId: new mongoose.Types.ObjectId(companyId) }
          ],
        }
      },
      { $unwind: "$userIds" },
      { $unwind: "$sessions" },
      {
        $project: {
          userId: "$userIds",
          duration: { $divide: [{ $subtract: ["$sessions.endTime", "$sessions.startTime"] }, 1000] },
          userlastWork: { $max: "$sessions.lastActiveTime" }
        },
      },
      {
        $sort: {
          userId: 1,
          userlastWork: -1
        }
      },
      {
        $group: {
          _id: "$userId",
          totalDuration: { $sum: "$duration" },
          lastWorkedOn: { $first: "$userlastWork" }
        }
      }
    ]);
  }

  let match: any = {
    $and: [{ 'role': 'user' }, { companyId: new mongoose.Types.ObjectId(companyId) }],
  };

  if (searchKeyword && searchKeyword !== '') {
    match = {
      $and: [{ 'role': 'user' }, { companyId: new mongoose.Types.ObjectId(companyId) }],
      $or: query.search,
    };
  }

  let userInProject = await User.aggregate([
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: 'projectTeamIds.value',
        as: 'projects'
      }
    },
    { $match: match },
    {
      $facet: {
        data: fromPayroll
          ? [{ $sort: sort }]
          : [{ $sort: sort }, { $skip: query.skip }, { $limit: query.limit }],
        metadata: [{ $count: "total" }]
      }
    }
  ]);

  return { userInProject, user_duration };
}
