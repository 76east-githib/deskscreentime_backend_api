import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import connectDB from "@database/connect-db";
import mongoose from "mongoose";
import AdditionalLeave from "@models/AdditionalLeave";
import User from "@models/User";
import Leave from "@models/Leave";
import moment from "moment-timezone";

const INDIA_TIMEZONE = 'Asia/Kolkata';

// Define the expected request body shape
interface AdditionalLeaveRequestBody {
  _id?: string;
  userId: string;
  leaveFrom: string;
  leaveTo: string;
  remark: string;
  leaveType: string;
  leaveDuration?: "halfleave" | "fullleave" | "shortleave";
}

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const {
      _id,
      userId,
      leaveFrom,
      leaveTo,
      remark,
      leaveType,
      leaveDuration,
    }: AdditionalLeaveRequestBody = req.body;
    if (!userId || !leaveFrom || !leaveTo) {
      return res.status(400).json({
          success: false,
          message: "User Name, leave from, and leave to dates are required.",
        });
    }

    // Create the holiday object
    const additionalLeave = {
      userId,
      leaveFrom,
      leaveTo,
      remark,
      leaveType,
      leaveDuration,
      deductions: {},
    };
    // Get current year in IST
    const currentYear = moment.tz(INDIA_TIMEZONE).year();

    if (_id) {
      if (leaveType == "apply") {
        const existingLeave = await AdditionalLeave.findById(_id);
        if (existingLeave.deductions) {
          const { casualLeaves, paidLeaves, unPaidLeaves } =
            existingLeave.deductions;

          // const user = await User.findById(userId);

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

          // Refund the previous deductions back to the user
          user[0].leaves[0].casualLeaves += casualLeaves;
          user[0].leaves[0].paidLeaves += paidLeaves;
          user[0].leaves[0].unPaidLeaves -= unPaidLeaves; // Unpaid leaves were deducted, so they should be refunded.

          // Save the refunded values
          await User.updateOne(
            { _id: new mongoose.Types.ObjectId(userId), "leaves.year": currentYear },
            {
              $set: {
                "leaves.$.casualLeaves": user[0].leaves[0].casualLeaves,
                "leaves.$.paidLeaves": user[0].leaves[0].paidLeaves,
                "leaves.$.unPaidLeaves": user[0].leaves[0].unPaidLeaves,
              },
            }
          );

          // Now, apply the new leave logic based on the updated dates
          let {
            casualLeaves: newCasualLeaves,
            paidLeaves: newPaidLeaves,
            unPaidLeaves: newUnPaidLeaves,
          } = user[0].leaves[0];
          const leaveDuration1 =
            (new Date(leaveTo).getTime() - new Date(leaveFrom).getTime()) /
            (1000 * 60 * 60 * 24) +
            1;

          const monthStart = moment.tz(leaveFrom, INDIA_TIMEZONE).startOf("month").toDate();
          const monthEnd = moment.tz(leaveFrom, INDIA_TIMEZONE).endOf("month").toDate();

          const existingShortLeaves = await Leave.countDocuments({
            userId: new mongoose.Types.ObjectId(userId),
            "date.fromDate": { $gte: monthStart, $lte: monthEnd },
            "dayType.shortDay": 1,
            _id: { $ne: new mongoose.Types.ObjectId(existingLeave._id) } // Exclude current leave if updating
          });

          let remainingLeaveDuration = 0;
          if (leaveDuration === 'shortleave') {
            remainingLeaveDuration = existingShortLeaves >= 2 ? 0.5 : 0;
          } else {
            remainingLeaveDuration = leaveDuration === 'halfleave' ? 0.5 : leaveDuration1;
          }
          const initialDeduction = remainingLeaveDuration;

          const deductions = {
            casualLeaves: 0,
            paidLeaves: 0,
            unPaidLeaves: 0,
          };

          // Deduct from casual leaves first
          if (newCasualLeaves > 0) {
            const casualLeaveDeduction = Math.min(
              newCasualLeaves,
              remainingLeaveDuration
            );
            newCasualLeaves -= casualLeaveDeduction;
            remainingLeaveDuration -= casualLeaveDeduction;
            deductions.casualLeaves = casualLeaveDeduction;
          }

          // Deduct from paid leaves
          if (remainingLeaveDuration > 0 && newPaidLeaves > 0) {
            const paidLeaveDeduction = Math.min(
              newPaidLeaves,
              remainingLeaveDuration
            );
            newPaidLeaves -= paidLeaveDeduction;
            remainingLeaveDuration -= paidLeaveDeduction;
            deductions.paidLeaves = paidLeaveDeduction;
          }

          // Add to unpaid leaves if there's remaining duration
          if (remainingLeaveDuration > 0) {
            deductions.unPaidLeaves = remainingLeaveDuration;
            newUnPaidLeaves += remainingLeaveDuration;
          }
          // Update the user with the new deductions
          await User.updateOne(
            { _id: new mongoose.Types.ObjectId(userId), "leaves.year": currentYear },
            {
              $set: {
                "leaves.$.casualLeaves": newCasualLeaves,
                "leaves.$.paidLeaves": newPaidLeaves,
                "leaves.$.unPaidLeaves": newUnPaidLeaves,
              },
            }
          );

          // Update the leave record with the new deductions
          additionalLeave.deductions = deductions;
          await AdditionalLeave.updateOne(
            { _id: new mongoose.Types.ObjectId(_id) },
            { $set: { ...additionalLeave, deductions } }
          );

          // Delete old entry from leave and insert new one
          await Leave.deleteOne({
            userId: new mongoose.Types.ObjectId(userId),
            date: {
              $elemMatch: {
                fromDate: new Date(existingLeave.leaveFrom),
                toDate: new Date(existingLeave.leaveTo),
              },
            },
          });

          // 2. Create the new Leave entry with updated dates and deductions
          await Leave.create({
            userId: new mongoose.Types.ObjectId(userId),
            date: [
              {
                fromDate: new Date(leaveFrom),
                toDate: new Date(leaveTo),
              },
            ],
            dayType: [
              {
                halfDay: leaveDuration === 'halfleave' ? 1 : 0,
                fullDay: (leaveDuration === 'halfleave' || leaveDuration === 'shortleave') ? 0 : (new Date(leaveTo).getTime() - new Date(leaveFrom).getTime()) /
                  (1000 * 60 * 60 * 24) +
                  1,
                shortDay: leaveDuration === 'shortleave' ? 1 : 0,
                shortDayConverted: leaveDuration === 'shortleave' ? initialDeduction > 0 : false,
              },
            ],
            leaveTypes: [
              {
                casual: deductions.casualLeaves,
                paid: deductions.paidLeaves,
                unPaid: deductions.unPaidLeaves,
              },
            ],
          });

          return res.status(200).json({
              success: true,
              message: `Leave updated successfully.`,
              data: additionalLeave,
            });
        }
      } else {
        // Update the holiday if an ID is provided for compensation case
        const updateAdditionalLeave = await AdditionalLeave.updateOne(
          { _id: new mongoose.Types.ObjectId(_id) },
          { $set: { ...additionalLeave } }
        );

        if (updateAdditionalLeave.modifiedCount > 0) {
          return res.status(200).json({
              success: true,
              message: `Leave updated successfully.`,
              data: updateAdditionalLeave,
            });
        } else {
          return res.status(404).json({
              success: false,
              message: "Leave not found or no changes made.",
            });
        }
      }
    }

    // Check if the holiday already exists
    const leaveFound = await AdditionalLeave.findOne({
      userId,
      $or: [{ leaveFrom: { $lte: leaveTo }, leaveTo: { $gte: leaveFrom } }],
    });

    if (leaveFound) {
      return res.status(409).json({
          success: false,
          message: "Additional Leave already exists.",
        });
    }

    // Create new holiday
    const additionalLeaveCreated = await AdditionalLeave.create(
      additionalLeave
    );
    if (leaveType == "apply") {
      // for apply leave
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

      // Update the user's paidLeaves
      let { casualLeaves, paidLeaves, unPaidLeaves } = user[0].leaves[0];
      const leaveDuration1 =
        (new Date(leaveTo).getTime() - new Date(leaveFrom).getTime()) /
        (1000 * 60 * 60 * 24) +
        1;

      const monthStart = moment.tz(leaveFrom, INDIA_TIMEZONE).startOf("month").toDate();
      const monthEnd = moment.tz(leaveFrom, INDIA_TIMEZONE).endOf("month").toDate();

      const existingShortLeaves = await Leave.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        "date.fromDate": { $gte: monthStart, $lte: monthEnd },
        "dayType.shortDay": 1,
      });

      let remainingLeaveDuration = 0;
      if (leaveDuration === 'shortleave') {
        remainingLeaveDuration = existingShortLeaves >= 2 ? 0.5 : 0;
      } else {
        remainingLeaveDuration = leaveDuration === 'halfleave' ? 0.5 : leaveDuration1;
      }
      const initialDeduction = remainingLeaveDuration;

      const deductions = { casualLeaves: 0, paidLeaves: 0, unPaidLeaves: 0 };
      if (casualLeaves > 0) {
        const casualLeaveDeduction = Math.min(
          casualLeaves,
          remainingLeaveDuration
        );
        casualLeaves -= casualLeaveDeduction;
        remainingLeaveDuration -= casualLeaveDeduction;
        deductions.casualLeaves = casualLeaveDeduction;
      }
      // Deduct from Paid Leaves
      if (remainingLeaveDuration > 0 && paidLeaves > 0) {
        const paidLeaveDeduction = Math.min(paidLeaves, remainingLeaveDuration);
        paidLeaves -= paidLeaveDeduction;
        remainingLeaveDuration -= paidLeaveDeduction;
        deductions.paidLeaves = paidLeaveDeduction;
      }
      // Add to Unpaid Leaves
      if (remainingLeaveDuration > 0) {
        deductions.unPaidLeaves = remainingLeaveDuration;
        unPaidLeaves += remainingLeaveDuration;
      }

      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(userId), "leaves.year": currentYear },
        {
          $set: {
            "leaves.$.casualLeaves": casualLeaves,
            "leaves.$.paidLeaves": paidLeaves,
            "leaves.$.unPaidLeaves": unPaidLeaves,
          },
        }
      );
      // Save deduction information to the AdditionalLeave document
      additionalLeaveCreated.deductions = deductions;
      await additionalLeaveCreated.save();

      await Leave.create({
        userId: new mongoose.Types.ObjectId(userId),
        date: [
          {
            fromDate: new Date(leaveFrom),
            toDate: new Date(leaveTo),
          },
        ],
        dayType: [
          {
            halfDay: leaveDuration === 'halfleave' ? 1 : 0,
            fullDay: (leaveDuration === 'halfleave' || leaveDuration === 'shortleave') ? 0 : 
              (new Date(leaveTo).getTime() - new Date(leaveFrom).getTime()) /
              (1000 * 60 * 60 * 24) +
              1,
            shortDay: leaveDuration === 'shortleave' ? 1 : 0,
            shortDayConverted: leaveDuration === 'shortleave' ? initialDeduction > 0 : false,
          },
        ],
        leaveTypes: [
          {
            casual: deductions.casualLeaves,
            paid: deductions.paidLeaves,
            unPaid: deductions.unPaidLeaves,
          },
        ],
      });
    } else {
      // for compensation leave
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
      if (!user) {
        return res.status(404).json({
            success: false,
            message: "User not found.",
          });
      }

      // Update the user's paidLeaves
      const updatedPaidLeaves = (user[0].leaves[0]?.paidLeaves || 0) + 1;
      const updateResult = await User.updateOne(
        { _id: new mongoose.Types.ObjectId(userId), "leaves.year": currentYear },
        { $set: { "leaves.$.paidLeaves": updatedPaidLeaves } }
      );
    }

    return res.status(201).json({
        success: true,
        message: `Leave created successfully.`,
        data: additionalLeaveCreated,
      });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
        success: false,
        message: "Server encountered an error.",
      });
  }
});
