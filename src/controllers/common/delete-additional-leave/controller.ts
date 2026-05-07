import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import AdditionalLeave from "@models/AdditionalLeave";
import Leave from "@models/Leave"; // Import the Leave model
import User from "@models/User";
import connectDB from "@database/connect-db";
import mongoose from "mongoose";

export const del = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { _id } = req.body;
  try {
    const objectId: any = new mongoose.Types.ObjectId(_id);

    // Find the leave to delete
    const existingLeave = await AdditionalLeave.findById(objectId);
    if (!existingLeave) {
      return res.status(404).json({
          success: false,
          message: "No Additional Leave found with the provided ID.",
        });
    }
 console.log("in existingLeave=======>",existingLeave)
    const { userId, leaveType, deductions, leaveFrom, leaveTo } = existingLeave;
    const currentYear = new Date().getFullYear();

    // Get the user and the specific year's leave entry
    const user: any = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      {
        $project: {
          _id: 1,
          fullname: 1,
          email: 1,
          leaves: {
            $filter: {
              input: "$leaves",
              as: "leave",
              cond: { $eq: ["$$leave.year", currentYear] },
            },
          },
        },
      },
    ]);

    if (!user || user.length === 0 || user[0].leaves.length === 0) {
      return res.status(404).json({
          success: false,
          message: "User or leave data not found.",
        });
    }

    const userLeaveData = user[0].leaves[0];
 console.log("in leaveType=======>",leaveType)

    // Update user's leave balances
    if (leaveType === "apply" && deductions) {
      const { casualLeaves, paidLeaves, unPaidLeaves } = deductions;
      userLeaveData.casualLeaves += casualLeaves;
      userLeaveData.paidLeaves += paidLeaves;
      userLeaveData.unPaidLeaves -= unPaidLeaves;
    } else if (leaveType === "compensation") {
    const leaveDuration =
    (new Date(leaveTo).getTime() - new Date(leaveFrom).getTime()) / (1000 * 60 * 60 * 24) + 1;
    console.log("leaveDuration==========>",leaveDuration)
    userLeaveData.paidLeaves -= leaveDuration;
    console.log("userLeaveData.paidLeaves===========>",userLeaveData.paidLeaves)
  }

    // Save updated user leave data
    await User.updateOne(
      { _id: user[0]._id, "leaves.year": currentYear },
      {
        $set: {
          "leaves.$.casualLeaves": userLeaveData.casualLeaves,
          "leaves.$.paidLeaves": userLeaveData.paidLeaves,
          "leaves.$.unPaidLeaves": userLeaveData.unPaidLeaves,
        },
      }
    );

    // // Delete related entry from Leave schema
    // await Leave.deleteOne({
    //   userId: existingLeave.userId,
    //   date: {
    //     $elemMatch: {
    //       fromDate: new Date(existingLeave.leaveFrom),
    //       toDate: new Date(existingLeave.leaveTo),
    //     },
    //   },
    // });

     await Leave.deleteOne({
       userId: existingLeave.userId,
       "date.fromDate": { $lte: new Date(existingLeave.leaveTo) },
       "date.toDate": { $gte: new Date(existingLeave.leaveFrom) },
      }); 

    // Delete from AdditionalLeave schema
    const deleteAdditionalLeave = await AdditionalLeave.deleteOne({ _id: objectId });
    console.log("deleteAdditionalLeave===========>",deleteAdditionalLeave)
    if (deleteAdditionalLeave.deletedCount > 0) {
      return res.status(200).json({
        success: true,
        message: "Additional Leave deletion successful.",
        status: 200,
      });
    } else {
      return res.status(404).json({
          success: false,
          message: "No Additional Leave found with the provided ID.",
        });
    }
  } catch (error) {
    console.error("Error deleting leave:", error);
    return res.status(500).json({ success: false, message: "Unable to delete leave." });
  }
});
