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
  const {
    userId,
    companyId,
    fullName,
    email,
    mobile,
    projectsIds,
    role,
  } = req.body;

  // Common user data
  let userData: any = {
    fullname: fullName,
    email,
    role,
    mobile,
    companyId,
    designation: "developer",
  };

  try {
    // ------------------------- EDIT CASE -------------------------
    if (userId && userId !== "") {
      const userUpdated = await User.findOneAndUpdate(
        { _id: userId },
        userData,
        { new: true }
      );

      if (!userUpdated) {
        return res.status(500).json({ success: false, message: "Unable to update user." });
      }

      // Remove user from previously assigned projects
      const userDetail = await User.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(userId) } },
        {
          $lookup: {
            from: "projects",
            localField: "_id",
            foreignField: "projectTeamIds.value",
            as: "userProjects",
          },
        },
        {
          $project: {
            userId: "$_id",
            fullName: "$fullname",
            email: "$email",
            mobile: "$mobile",
            createdAt: "$createdAt",
            userProjects: "$userProjects",
          },
        },
      ]);

      const bulkOpsRemove =
        userDetail &&
        userDetail[0]?.userProjects?.map((project: any) => ({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(project._id) },
            update: {
              $pull: {
                projectTeamIds: {
                  value: new mongoose.Types.ObjectId(userId),
                },
              },
            },
          },
        }));

      if (bulkOpsRemove?.length) await Project.bulkWrite(bulkOpsRemove);

      // Assign user to new selected projects
      if (projectsIds?.length) {
        const bulkOps = projectsIds.map((project: any) => ({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(project.value) },
            update: {
              $push: {
                projectTeamIds: {
                  value: new mongoose.Types.ObjectId(userUpdated._id),
                  label: userUpdated.fullname,
                },
              },
            },
          },
        }));

        await Project.bulkWrite(bulkOps);
      }

      return res.status(200).json({ success: true, message: "User Updated" });
    }

    // ------------------------- ADD CASE -------------------------
    if (!fullName || !email) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const userFound = await User.findOne({ email });
    if (userFound) {
      return res.status(200).json({ success: false, message: "User already exists with this email." });
    }

    const companyData = await User.findById(companyId);
    if (!companyData) {
      return res.status(404).json({ success: false, message: "Company not found." });
    }

    // Generate random password
    const randompass = Math.random().toString(36).slice(-8);
    const hashedPass = bcrypt.hashSync(randompass, 10);

    userData.password = hashedPass;
    userData.companyName = companyData.companyName;

    const newUser = await User.create(userData);

    // Send invite email
    const EmailData = htmlInviteUser
      .replace(/#fullName#/g, newUser.fullname)
      .replace(/#email#/g, newUser.email)
      .replace(/#password#/g, randompass)
      .replace(/#companyName#/g, companyData.companyName);

    await sendEmail("Invitation Email!", newUser.email, EmailData);

    // Assign projects
    if (projectsIds?.length) {
      const bulkOps = projectsIds.map((project: any) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(project.value) },
          update: {
            $push: {
              projectTeamIds: {
                value: new mongoose.Types.ObjectId(newUser._id),
                label: newUser.fullname,
              },
            },
          },
        },
      }));
      await Project.bulkWrite(bulkOps);
    }

    return res.status(200).json({ success: true, message: "User Created" });
  } catch (error) {
    return res.status(500).json({
        success: false,
        message: "Server error occurred.",
        error: (error as Error).message,
      });
  }
});
