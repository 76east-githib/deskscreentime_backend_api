import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from "@models/Project";
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  var {
    prId,
    prName,
    prDescription,
    prTechnology,
    prGitUrl,
    prWebsiteUrl,
    prTeamIds,
    prStatus,
    companyId
  } = req.body;

  const project: object = {
    projectName: prName,
    projectDescription: prDescription,
    projectTechnology: prTechnology,
    projectGitUrl: prGitUrl,
    projectWebsiteUrl: prWebsiteUrl,
    projectStatus: prStatus,
    projectTeamIds: prTeamIds,
    companyId: companyId
  };
  // project["projectTeamIds"] = prTeamIds;

  if (prId) {
    // edit case
    try {
      let projectUpdated = await Project.findOneAndUpdate(
        { _id: prId },
        project,
        { returnNewDocument: true }
      );
      if (projectUpdated) {
        return res.status(200).json({
            success: true,
            message: "Project Updated.",
            data: projectUpdated,
          });
      } else {
        return res.status(500).json({
            success: false,
            message: "Unable to update, please try after some time.",
          });
      }
    } catch (error) {
      return res.status(500).json({
          success: false,
          message: "Server encountered some error",
          error: error,
        });
    }
  } else {
    // add case
    if (prName) {
      try {
        const projectFound = await Project.findOne({ projectName: prName });
        if (projectFound != null || projectFound) {
          return res.status(200).json({
              success: false,
              message: "Project already exists.",
            });
        } else {
          const projectCreated = await Project.create(project);

          if (projectCreated) {
            return res.status(200).json({
                success: true,
                message: "Project Created",
                data: projectCreated,
              });
          } else {
            return res.status(500).json({
                success: false,
                message: "Unable to add, please try after some time",
              });
          }
        }
      } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server encountered some error",
            error: error,
          });
      }
    } else {
      return res.status(400).json({
          success: false,
          message: "All Fields are required",
        });
    }
  }
});
