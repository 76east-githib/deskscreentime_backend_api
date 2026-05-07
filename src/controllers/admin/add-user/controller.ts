import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from "@models/Project";
import connectDB from "@database/connect-db";
import User from "@models/User";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { htmlInviteUser } from "@helpers/mailHtml";
import { sendEmail } from "@helpers/sendMail";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  var {
    userId,
    companyId,
    fullName,
    email,
    mobile,
    projectsIds,
    role,
    designation,
    address,
    joiningDate,
    bankDetails,
  } = req.body;

  let userData: any = {
    fullname: fullName,
    email: email,
    role: role,
    mobile: mobile,
    companyId: companyId,
    designation: designation,
    address: address,
    joiningDate: joiningDate,
    bankDetails: bankDetails,
    leaves: [{
      year: new Date().getFullYear(),
      casualLeaves: 0,
      paidLeaves: 0,
      unPaidLeaves: 0,
    }],
  };

  if (userId && userId !== "") {
    // console.log("in edit case");
    // edit case
    try {
      let projectUpdated = await User.findOneAndUpdate(
        { _id: userId },
        userData,
        { returnNewDocument: true }
      );
      if (projectUpdated) {
        // assign user to selected project

        // remove user from projects assigned before
        let userDetail = await User.aggregate([
          { $match: { _id: new mongoose.Types.ObjectId(userId) } },
          {
            $lookup: {
              from: "projects",
              localField: "_id",
              foreignField: "projectTeamIds.value",
              as: "userProject",
            },
          },
          // { "$unwind": "$userProject" },
          {
            $project: {
              userId: "$_id",
              fullName: "$fullname",
              email: "$email",
              mobile: "$mobile",
              createdAt: "$createdAt",
              userProjects: "$userProject",
            },
          },
        ]);

        const bulkOpsRemove =
          userDetail &&
          userDetail[0].userProjects.map((project: any) => {
            return {
              updateOne: {
                filter: { _id: new mongoose.Types.ObjectId(project._id) },
                update: {
                  $pull: {
                    projectTeamIds: {
                      value: new mongoose.Types.ObjectId(userId), // Add the appropriate condition based on your needs
                    },
                  },
                },
              },
            };
          });

        const resultRemove = await Project.bulkWrite(bulkOpsRemove);

        if (projectsIds) {
          const bulkOps =
            projectsIds &&
            projectsIds.map((project: any) => {
              return {
                updateOne: {
                  filter: { _id: new mongoose.Types.ObjectId(project.value) },
                  update: {
                    $push: {
                      projectTeamIds: {
                        value: new mongoose.Types.ObjectId(projectUpdated._id),
                        label: projectUpdated.fullname,
                      },
                    },
                  },
                },
              };
            });
          const result = await Project.bulkWrite(bulkOps);
          if (result)
            return res.status(200).json({ success: true, message: "User Updated" });
        }
        // in case if no project is assigned to user by company
        return res.status(200).json({ success: true, message: "User Updated" });
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
    if (fullName && email) {
      try {
        const userFound = await User.findOne({ email: email });
        if (userFound != null || userFound) {
          return res.status(200).json({
              success: false,
              message: "User already exists with this email.",
            });
        } else {
          // find companyName by Id
          // const companyData = await User.findOne({ _id: new mongoose.Types.ObjectId(companyId) });
          const companyData = await User.findById({ _id: companyId });
          let randompass = Math.random().toString(36).slice(-8);
          let passworForUser = bcrypt.hashSync(randompass, 10);
          userData["password"] = passworForUser;
          userData["companyName"] = companyData.companyName;
          const projectCreated = await User.create(userData);

          // send mail to newly added user
          let EmailData: any = "";
          EmailData += htmlInviteUser
            .replace(/#fullName#/g, projectCreated.fullname)
            .replace(/#email#/g, projectCreated.email)
            .replace(/#password#/g, randompass)
            .replace(/#companyName#/g, companyData.companyName);
          let sentEmail = sendEmail(
            `Invitatiton email!`,
            projectCreated.email,
            EmailData
          );

          if (projectCreated) {
            // assign user to selected project
            if (projectsIds) {
              const bulkOps =
                projectsIds &&
                projectsIds.map((project: any) => {
                  return {
                    updateOne: {
                      filter: {
                        _id: new mongoose.Types.ObjectId(project.value),
                      },
                      update: {
                        $push: {
                          projectTeamIds: {
                            value: new mongoose.Types.ObjectId(
                              projectCreated._id
                            ),
                            label: projectCreated.fullname,
                          },
                        },
                      },
                    },
                  };
                });
              const result = await Project.bulkWrite(bulkOps);
              if (result)
                return res.status(200).json({ success: true, message: "User Created" });
            }
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
