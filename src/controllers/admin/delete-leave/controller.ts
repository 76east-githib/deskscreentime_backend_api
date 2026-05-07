import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Leave from "@models/Leave";
import User from "@models/User";
import connectDB from "@database/connect-db";
import mongoose from "mongoose";

export const del = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  const { data, year } = req.body;
  const { _id, leaveTypes, userId } = data;

  try {
    const leaveToDelete = await Leave.findById(_id);
    if (!leaveToDelete) {
      return res.status(404).json({ success: false, message: "Leave not found." });
    }

    const isShortLeave = leaveToDelete.dayType?.[0]?.shortDay === 1;

    if (isShortLeave) {
      // ── Short leave deletion: recalculate all short leaves this month ──
      const moment = (await import("moment-timezone")).default;
      const INDIA_TIMEZONE = "Asia/Kolkata";
      const leaveDate = leaveToDelete.date?.[0]?.fromDate;
      const monthStart = moment.tz(leaveDate, INDIA_TIMEZONE).startOf("month").toDate();
      const monthEnd = moment.tz(leaveDate, INDIA_TIMEZONE).endOf("month").toDate();

      // Get ALL short leaves this month sorted by date (including the one being deleted)
      const allShortLeavesThisMonth = await Leave.find({
        userId,
        "date.fromDate": { $gte: monthStart, $lte: monthEnd },
        "dayType.shortDay": 1,
      }).sort({ "date.fromDate": 1 });

      // Get current user balance
      const userDoc = await User.findOne({ _id: userId, "leaves.year": year });
      if (!userDoc) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      const leaveBalance = userDoc.leaves.find((l: any) => l.year === year);
      let { casualLeaves, paidLeaves, unPaidLeaves } = leaveBalance;

      // Step 1: Refund ALL deductions from ALL short leaves this month
      for (const sl of allShortLeavesThisMonth) {
        const lt = sl.leaveTypes?.[0];
        casualLeaves += lt?.casual || 0;
        paidLeaves += lt?.paid || 0;
        unPaidLeaves -= lt?.unPaid || 0;
      }

      // Step 2: Delete the leave record
      await Leave.deleteOne({ _id: new mongoose.Types.ObjectId(_id) });

      // Step 3: Re-apply deductions for remaining short leaves (3rd+ only)
      const remainingShortLeaves = allShortLeavesThisMonth.filter(
        (sl: any) => sl._id.toString() !== _id
      );

      for (let i = 0; i < remainingShortLeaves.length; i++) {
        const sl = remainingShortLeaves[i];
        const shouldDeduct = i >= 2; // 0-indexed: index 0,1 = free; index 2+ = deduct

        const used = { casual: 0, paid: 0, unPaid: 0 };

        if (shouldDeduct) {
          let remaining = 0.5;

          if (casualLeaves >= remaining) {
            used.casual = remaining;
            casualLeaves -= remaining;
            remaining = 0;
          } else {
            used.casual = casualLeaves;
            remaining -= casualLeaves;
            casualLeaves = 0;
          }

          if (remaining > 0 && paidLeaves >= remaining) {
            used.paid = remaining;
            paidLeaves -= remaining;
            remaining = 0;
          } else if (remaining > 0) {
            used.paid = paidLeaves;
            remaining -= paidLeaves;
            paidLeaves = 0;
          }

          if (remaining > 0) {
            used.unPaid = remaining;
            unPaidLeaves += remaining;
          }
        }

        await Leave.updateOne(
          { _id: sl._id },
          {
            $set: {
              "dayType.0.shortDayConverted": shouldDeduct,
              "leaveTypes.0.casual": used.casual,
              "leaveTypes.0.paid": used.paid,
              "leaveTypes.0.unPaid": used.unPaid,
            },
          }
        );
      }

      // Step 4: Update user balance once
      await User.updateOne(
        { _id: userId, "leaves.year": year },
        {
          $set: {
            "leaves.$.casualLeaves": casualLeaves,
            "leaves.$.paidLeaves": paidLeaves,
            "leaves.$.unPaidLeaves": unPaidLeaves,
          },
        }
      );

      return res.status(200).json({ success: true });
    }

    // ── Non-short leave: original refund logic ──
    if (leaveTypes && leaveTypes[0].casual && leaveTypes[0].casual !== 0) {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(userId), "leaves.year": year },
        { $inc: { "leaves.$.casualLeaves": leaveTypes[0].casual } }
      );
    }
    if (leaveTypes && leaveTypes[0].paid && leaveTypes[0].paid !== 0) {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(userId), "leaves.year": year },
        { $inc: { "leaves.$.paidLeaves": leaveTypes[0].paid } }
      );
    }
    if (leaveTypes && leaveTypes[0].unPaid && leaveTypes[0].unPaid !== 0) {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(userId), "leaves.year": year },
        { $inc: { "leaves.$.unPaidLeaves": -Math.abs(leaveTypes[0].unPaid) } }
      );
    }

    const deleteLeave = await Leave.deleteOne({ _id: new mongoose.Types.ObjectId(_id) });
    if (deleteLeave.deletedCount > 0) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(500).json({ success: false, message: "Unable to delete, please try after some time." });
    }
  } catch (error) {
    console.error("Error while deleting leave:", error);
    return res.status(500).json({ success: false, message: "Unable To Delete" });
  }
});
