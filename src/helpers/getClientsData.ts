import mongoose from "mongoose";
import Task from "@models/Task";
import User from "@models/User";

export async function getClientsData({
  searchKeyword,
  sortBy,
  pageNo,
  size,
  companyId,
}: any) {
  let query: any = { skip: 0, limit: 10, search: [] };
  let sort: any = { createdAt: -1 };

  if (pageNo || size) {
    pageNo = parseInt(pageNo);
    size = parseInt(size);

    if (pageNo <= 0) {
      return { success: false, message: "Invalid page number" };
    }

    query.skip = size * (pageNo - 1);
    query.limit = size;
  }

  if (sortBy?.sortColumn && sortBy?.sortDirection) {
    sort = { [sortBy.sortColumn]: sortBy.sortDirection };
  }

  if (searchKeyword) {
    query.search.push(
      { email: { $regex: searchKeyword, $options: "i" } },
      { fullname: { $regex: searchKeyword, $options: "i" } }
    );
  }

  // Only role = client
  let match: any = {
    $and: [
      { role: "client" },
      { companyId: new mongoose.Types.ObjectId(companyId) },
    ],
  };

  if (searchKeyword) {
    match = {
      $and: [
        { role: "client" },
        { companyId: new mongoose.Types.ObjectId(companyId) },
      ],
      $or: query.search,
    };
  }

  let userInProject = await User.aggregate([
    {
      $lookup: {
        from: "projects",
        localField: "_id",
        foreignField: "projectTeamIds.value",
        as: "projects",
      },
    },
    { $match: match },
    {
      $facet: {
        data: [
          { $sort: sort },
          { $skip: query.skip },
          { $limit: query.limit }
        ],
        metadata: [{ $count: "total" }],
      },
    },
  ]);

  return { userInProject, user_duration: [] };
}
