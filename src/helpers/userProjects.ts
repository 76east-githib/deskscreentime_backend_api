
import Project from '@models/Project';
import User from '@models/User';
import connectDB from "@database/connect-db";
var mongoose = require('mongoose');

export async function getUserProjects(userId:any, page = 1, per_page = 10) {
  await connectDB();

  per_page = per_page ? per_page : 10;
  page = page > 1 ? page : 1;

  let projectAllot = await Project.find(
    
    { "projectTeamIds.value": new mongoose.Types.ObjectId(userId) },
    { _id: 1, projectName: 1 }
  ).sort({ "createdAt": -1 });
  var query = {
    userId: userId
  }

  var paginateOptions = {
    select: '-__v',
    sort: { createdAt: -1 },
    lean: false,
    page: Number(page),
    limit: Number(per_page)
  }

  let user = await User.findById(userId);

  return { user, projectAllot };
}

