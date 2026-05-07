import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Leave from "@models/Leave";
import Task from "@models/Task";
import User from "@models/User";
import Holiday from "@models/Holiday";
import AdditionalLeave from "@models/AdditionalLeave";
import connectDB from "@database/connect-db";
import { Types } from "mongoose";
import {
  getCurrentISTDateString,
  getISTDateRangeForQuery,
  INDIA_TIMEZONE,
} from "@utils/dateUtils";

type LeaveKind = "casual" | "paid" | "unPaid";
type LeaveMode = "half" | "full" | "short";

interface LeaveDeduction {
  casual?: number;
  paid?: number;
  unPaid?: number;
}

interface LeaveRecord {
  _id: Types.ObjectId;
  leaves: {
    year: number;
    casualLeaves: number;
    paidLeaves: number;
    unPaidLeaves: number;
  }[];
}

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    // Use IST timezone for current date
    const moment = (await import("moment-timezone")).default;

    const formattedDate = getCurrentISTDateString();

    const currentDate = moment.tz(formattedDate, INDIA_TIMEZONE);
    const dayOfWeek = currentDate.day(); // 0 = Sunday, 6 = Saturday
    console.log("Processing leave for IST date:", formattedDate);
    console.log("Day of week:", dayOfWeek);

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(200).json({
        message: "No leave record needed for weekends.",
      });
    }

    // Get start and end of day in IST
    const { start, end } = getISTDateRangeForQuery(formattedDate);
    const startOfDay = new Date(start);
    const endOfDay = new Date(end);

    const holiday = await Holiday.findOne({
      holidayDate: { $gte: startOfDay, $lte: endOfDay },
    });

    if (holiday) {
      return res.status(200).json({
        message: "No leave record needed for holidays.",
      });
    }

    const currentYear = currentDate.year();
    // const currentYear = currentDate.getFullYear();

    const activeUsersToday = await Task.aggregate([
      { $unwind: "$sessions" },
      {
        $match: {
          $or: [
            { "sessions.startTime": { $gte: startOfDay, $lt: endOfDay } },
            { "sessions.endTime": { $gte: startOfDay, $lt: endOfDay } },
            {
              $and: [
                { "sessions.startTime": { $lt: startOfDay } },
                { "sessions.endTime": { $gt: endOfDay } },
              ],
            },
          ],
        },
      },
      {
        $addFields: {
          effectiveUserId: {
            $ifNull: [
              "$sessions.userId",
              {
                $cond: [
                  { $eq: [{ $size: { $ifNull: ["$userIds", []] } }, 1] },
                  { $arrayElemAt: ["$userIds", 0] },
                  null,
                ],
              },
            ],
          },
        },
      },
      {
        $match: {
          effectiveUserId: { $ne: null },
        },
      },
      {
        // Clamp session times to today's IST boundaries to handle multi-day crashed sessions
        $addFields: {
          clampedStart: { $max: ["$sessions.startTime", startOfDay] },
          clampedEnd: {
            $cond: [
              { $ifNull: ["$sessions.endTime", false] },
              { $min: ["$sessions.endTime", endOfDay] },
              null,
            ],
          },
          // Only sessions that actually started today (for morning window & second-half detection)
          nativeStartToday: {
            $cond: [
              { $gte: ["$sessions.startTime", startOfDay] },
              "$sessions.startTime",
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$effectiveUserId",
          lastEndTime: { $max: "$clampedEnd" },
          firstStartTime: { $min: "$nativeStartToday" },
          clampedFirstStart: { $min: "$clampedStart" },
        },
      },
      {
        $addFields: {
          // Wall-clock hours clamped to today: handles multi-day sessions correctly
          totalTrackerTime: {
            $cond: [
              { $and: [{ $ifNull: ["$lastEndTime", false] }, { $ifNull: ["$firstStartTime", false] }] },
              { $subtract: ["$lastEndTime", "$firstStartTime"] },
              0,
            ],
          },
        },
      },
    ]);

    const activeUserIds = activeUsersToday.map((user) => user._id);
    const inactiveUsersToday = await User.find({
      _id: { $nin: activeUserIds },
      alternateTracker: "UNUSED",
      role: "user",
    });

    const usersWithAdditionalLeave = await AdditionalLeave.find({
      $or: [
        {
          leaveFrom: { $lte: endOfDay },
          leaveTo: { $gte: startOfDay },
        },
      ],
      userId: { $in: inactiveUsersToday.map((user) => user._id) },
    });

    const userIdsWithAdditionalLeave = usersWithAdditionalLeave.map((record) =>
      record.userId.toString()
    );

    for (const item of usersWithAdditionalLeave) {
      const userRecord = await User.findOne({
        _id: item.userId,
        "leaves.year": currentYear,
      });

      if (userRecord && item.leaveType !== "apply") {
        const leaveRecord = userRecord.leaves.find(
          (leave: any) => leave.year === currentYear
        );

        if (leaveRecord?.paidLeaves !== undefined) {
          const updatedPaidLeaves = leaveRecord.paidLeaves - 1;

          await User.updateOne(
            { _id: item.userId, "leaves.year": currentYear },
            { $set: { "leaves.$.paidLeaves": updatedPaidLeaves } }
          );
        }
      }
    }

    const finalInactiveUsers = inactiveUsersToday.filter(
      (user) => !userIdsWithAdditionalLeave.includes(user._id.toString())
    );

    for (const user of finalInactiveUsers) {
      await markLeave(user._id, "full", formattedDate, currentYear);
    }

    // Morning window: 9:30 AM – 12:00 PM IST
    const morningStart = moment.tz(formattedDate, INDIA_TIMEZONE).hour(9).minute(30).second(0).millisecond(0).toDate();
    const morningEnd = moment.tz(formattedDate, INDIA_TIMEZONE).hour(12).minute(0).second(0).millisecond(0).toDate();

    // Afternoon cutoff for half day: 2:00 PM IST
    const afternoonCutoff = moment.tz(formattedDate, INDIA_TIMEZONE).hour(14).minute(0).second(0).millisecond(0).toDate();

    // Second half start threshold: 1:00 PM IST (user missed morning)
    const secondHalfStart = moment.tz(formattedDate, INDIA_TIMEZONE).hour(13).minute(0).second(0).millisecond(0).toDate();

    for (const user of activeUsersToday) {
      const userId = user._id;
      const totalHours = user.totalTrackerTime / (1000 * 60 * 60);
      const firstStartTime = user.firstStartTime ? new Date(user.firstStartTime) : null;
      const lastEndTime = user.lastEndTime ? new Date(user.lastEndTime) : null;

      // Short leave only if the FIRST session of the day started in the morning window
      // (prevents false positives when tracker restarts after a crash when user was already working before 9:30 AM)
      const isInMorningWindow = firstStartTime !== null && firstStartTime >= morningStart && firstStartTime < morningEnd;

      if (isInMorningWindow) {
        // Short leave depends only on morning window presence
        // Skip short leave for bidders
        const userDoc = await User.findById(userId).lean<{ designation?: string }>();
        if (userDoc?.designation?.toLowerCase() !== "bidder") {
          await markShortLeave(userId, formattedDate, currentYear);
        }
        continue;
      }

      const loggedOutByAfternoon = lastEndTime !== null && lastEndTime <= afternoonCutoff;
      const startedInSecondHalf = firstStartTime !== null && firstStartTime >= secondHalfStart;

      if (totalHours < 6 && (loggedOutByAfternoon || startedInSecondHalf)) {
        // Half day if:
        // 1) Less than 6 hrs AND logged out by 2:00 PM (left early)
        // 2) Less than 6 hrs AND first session started at or after 1:00 PM (missed morning)
        await markLeave(userId, "half", formattedDate, currentYear);
      }
    }
    return res.status(200).json({
      message: "Leave records processed successfully.",
    });
  } catch (error) {
    console.error("Error processing leave records:", error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    const moment = (await import("moment-timezone")).default;
    const url = new URL(req.originalUrl, `http://${req.get('host') || 'localhost'}`);
    const userId = url.searchParams.get("userId");
    const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
    const year = parseInt(url.searchParams.get("year") || date.split("-")[0], 10);
    const debugSessions = url.searchParams.get("debugSessions") === "1";
    const apply = url.searchParams.get("apply");

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId query parameter is required." });
    }

    // apply=shortLeave → actually run markShortLeave for this user/date
    if (apply === "shortLeave") {
      await markShortLeave(userId, date, year);
      const moment2 = (await import("moment-timezone")).default;
      const monthStart = moment2.tz(date, INDIA_TIMEZONE).startOf("month").toDate();
      const monthEnd = moment2.tz(date, INDIA_TIMEZONE).endOf("month").toDate();
      const totalThisMonth = await Leave.countDocuments({
        userId,
        "date.fromDate": { $gte: monthStart, $lte: monthEnd },
        "dayType.shortDay": 1,
      });
      return res.status(200).json({
        success: true,
        message: "Short leave applied.",
        data: { userId, date, year, totalShortLeavesThisMonth: totalThisMonth },
      });
    }

    // apply=halfDay → actually run markLeave("half") for this user/date
    if (apply === "halfDay") {
      await markLeave(userId, "half", date, year);
      return res.status(200).json({
        success: true,
        message: "Half day leave applied.",
        data: { userId, date, year },
      });
    }

    // apply=fullDay → actually run markLeave("full") for this user/date
    if (apply === "fullDay") {
      await markLeave(userId, "full", date, year);
      return res.status(200).json({
        success: true,
        message: "Full day leave applied.",
        data: { userId, date, year },
      });
    }

    const { start, end } = getISTDateRangeForQuery(date);
    const startOfDay = new Date(start);
    const endOfDay = new Date(end);

    // Debug mode: return raw sessions for this user on this date
    if (debugSessions) {
      const rawSessions = await Task.aggregate([
        {
          $match: {
            $or: [
              { "sessions.userId": new Types.ObjectId(userId) },
              { userIds: new Types.ObjectId(userId) },
            ],
          },
        },
        { $unwind: "$sessions" },
        {
          $match: {
            $or: [
              { "sessions.startTime": { $gte: startOfDay, $lt: endOfDay } },
              { "sessions.endTime": { $gte: startOfDay, $lt: endOfDay } },
            ],
          },
        },
        {
          $project: {
            taskName: 1,
            "sessions._id": 1,
            "sessions.userId": 1,
            "sessions.startTime": 1,
            "sessions.endTime": 1,
            "sessions.idleTime": 1,
            "sessions.status": 1,
            userIds: 1,
          },
        },
      ]);
      return res.status(200).json({
        success: true,
        debugSessions: true,
        date,
        startOfDay,
        endOfDay,
        count: rawSessions.length,
        sessions: rawSessions,
      });
    }

    // Check if weekend
    const dayOfWeek = moment.tz(date, INDIA_TIMEZONE).day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(200).json({ success: true, dryRun: true, result: "SKIP", reason: "Weekend" });
    }

    // Check if holiday
    const holiday = await Holiday.findOne({ holidayDate: { $gte: startOfDay, $lte: endOfDay } });
    if (holiday) {
      return res.status(200).json({ success: true, dryRun: true, result: "SKIP", reason: "Holiday" });
    }

    // Check if user has additional leave
    const additionalLeave = await AdditionalLeave.findOne({
      userId,
      leaveFrom: { $lte: endOfDay },
      leaveTo: { $gte: startOfDay },
    });
    if (additionalLeave) {
      return res.status(200).json({ success: true, dryRun: true, result: "SKIP", reason: "AdditionalLeave applied" });
    }

    // ── EXACT same aggregate as POST activeUsersToday, filtered to this user via effectiveUserId ──
    const activeUsersToday = await Task.aggregate([
      { $unwind: "$sessions" },
      {
        $match: {
          $or: [
            { "sessions.startTime": { $gte: startOfDay, $lt: endOfDay } },
            { "sessions.endTime": { $gte: startOfDay, $lt: endOfDay } },
            {
              $and: [
                { "sessions.startTime": { $lt: startOfDay } },
                { "sessions.endTime": { $gt: endOfDay } },
              ],
            },
          ],
        },
      },
      {
        $addFields: {
          effectiveUserId: {
            $ifNull: [
              "$sessions.userId",
              {
                $cond: [
                  { $eq: [{ $size: { $ifNull: ["$userIds", []] } }, 1] },
                  { $arrayElemAt: ["$userIds", 0] },
                  null,
                ],
              },
            ],
          },
        },
      },
      {
        $match: {
          effectiveUserId: new Types.ObjectId(userId),
        },
      },
      {
        // Clamp session times to today's IST boundaries to handle multi-day crashed sessions
        $addFields: {
          clampedStart: { $max: ["$sessions.startTime", startOfDay] },
          clampedEnd: {
            $cond: [
              { $ifNull: ["$sessions.endTime", false] },
              { $min: ["$sessions.endTime", endOfDay] },
              null,
            ],
          },
          // Only sessions that actually started today (for morning window & second-half detection)
          nativeStartToday: {
            $cond: [
              { $gte: ["$sessions.startTime", startOfDay] },
              "$sessions.startTime",
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$effectiveUserId",
          lastEndTime: { $max: "$clampedEnd" },
          firstStartTime: { $min: "$nativeStartToday" },
          clampedFirstStart: { $min: "$clampedStart" },
        },
      },
      {
        $addFields: {
          // Wall-clock hours clamped to today: handles multi-day sessions correctly
          totalTrackerTime: {
            $cond: [
              { $and: [{ $ifNull: ["$lastEndTime", false] }, { $ifNull: ["$firstStartTime", false] }] },
              { $subtract: ["$lastEndTime", "$firstStartTime"] },
              0,
            ],
          },
        },
      },
    ]);

    const morningStart = moment.tz(date, INDIA_TIMEZONE).hour(9).minute(30).second(0).millisecond(0).toDate();
    const morningEnd = moment.tz(date, INDIA_TIMEZONE).hour(12).minute(0).second(0).millisecond(0).toDate();
    const afternoonCutoff = moment.tz(date, INDIA_TIMEZONE).hour(14).minute(0).second(0).millisecond(0).toDate();
    const secondHalfStart = moment.tz(date, INDIA_TIMEZONE).hour(13).minute(0).second(0).millisecond(0).toDate();

    if (!activeUsersToday.length) {
      // No session at all → check if user qualifies for full day
      const userDoc = await User.findById(userId).select("alternateTracker role").lean<{ alternateTracker?: string; role?: string }>();
      if (userDoc?.alternateTracker !== "UNUSED" || userDoc?.role !== "user") {
        return res.status(200).json({ success: true, dryRun: true, result: "SKIP", reason: "User excluded from full day check (alternateTracker or role mismatch)" });
      }
      return res.status(200).json({ success: true, dryRun: true, result: "FULL_DAY", reason: "No session found for the day" });
    }

    const s = activeUsersToday[0];
    const totalHours = s.totalTrackerTime / (1000 * 60 * 60);
    const firstStartTime = s.firstStartTime ? new Date(s.firstStartTime) : null;
    const lastEndTime = s.lastEndTime ? new Date(s.lastEndTime) : null;

    const loggedOutByAfternoon = lastEndTime !== null && lastEndTime <= afternoonCutoff;
    const startedInSecondHalf = firstStartTime !== null && firstStartTime >= secondHalfStart;

    // Short leave only if FIRST session of the day started in morning window
    const isInMorningWindow = firstStartTime !== null && firstStartTime >= morningStart && firstStartTime < morningEnd;

    // Short leave month count
    const monthStart = moment.tz(date, INDIA_TIMEZONE).startOf("month").toDate();
    const monthEnd = moment.tz(date, INDIA_TIMEZONE).endOf("month").toDate();
    const existingShortLeavesThisMonth = await Leave.countDocuments({
      userId,
      "date.fromDate": { $gte: monthStart, $lte: monthEnd },
      "dayType.shortDay": 1,
    });

    const userDoc = await User.findById(userId).select("designation").lean<{ designation?: string }>();
    const isBidder = userDoc?.designation?.toLowerCase() === "bidder";

    let result: string;
    let reason: string;

    if (isInMorningWindow) {
      if (isBidder) {
        result = "SKIP";
        reason = "User is bidder — short leave skipped";
      } else {
        const willDeduct = existingShortLeavesThisMonth >= 2;
        result = "SHORT_LEAVE";
        reason = `Session started in morning window. Short leaves this month: ${existingShortLeavesThisMonth}. Will deduct 0.5 balance: ${willDeduct}`;
      }
    } else if (totalHours < 6 && (loggedOutByAfternoon || startedInSecondHalf)) {
      result = "HALF_DAY";
      reason = loggedOutByAfternoon
        ? `Worked ${totalHours.toFixed(2)} hrs and logged out by 2:00 PM (${lastEndTime?.toISOString()})`
        : `Worked ${totalHours.toFixed(2)} hrs and first session started after 1:00 PM (${firstStartTime?.toISOString()})`;
    } else {
      result = "NO_LEAVE";
      reason = `Worked ${totalHours.toFixed(2)} hrs — no leave condition matched`;
    }

    return res.status(200).json({
      success: true,
      dryRun: true,
      result,
      reason,
      debug: {
        date,
        totalHours: +totalHours.toFixed(2),
        firstStartTime: firstStartTime?.toISOString(),
        lastEndTime: lastEndTime?.toISOString(),
        isInMorningWindow,
        loggedOutByAfternoon,
        startedInSecondHalf,
        existingShortLeavesThisMonth,
        isBidder,
      },
    });
  } catch (error) {
    console.error("Error in dry run:", error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

async function markLeave(
  userId: string,
  leaveType: LeaveMode, // "half" | "full"
  formattedDate: string,
  currentYear: number
) {
  const user = await User.findOne({
    _id: userId,
    "leaves.year": currentYear,
  }).lean<LeaveRecord>();

  if (!user) return;

  const leaveBalance = user.leaves.find(l => l.year === currentYear);
  if (!leaveBalance) return;

  let { casualLeaves, paidLeaves, unPaidLeaves } = leaveBalance;

  const today = new Date(formattedDate);
  const todayStr = formattedDate;
  const weekday = today.getDay(); // 0 Sun, 1 Mon

  // --------------------------------
  // 1️⃣ Collect ALL continuous dates
  // --------------------------------
  const collectedDates: string[] = [];

  // 🟡 Sandwich logic (Fri-Sat-Sun-Mon)
  if (weekday === 1) {
    const friday = new Date(today);
    friday.setDate(today.getDate() - 3);
    const fridayStr = friday.toISOString().split("T")[0];

    const fridayLeave = await Leave.findOne({
      userId,
      "date.fromDate": fridayStr,
    });

    if (fridayLeave) {
      collectedDates.push(
        fridayStr,
        new Date(friday.getTime() + 86400000).toISOString().split("T")[0], // Sat
        new Date(friday.getTime() + 2 * 86400000).toISOString().split("T")[0] // Sun
      );
    }
  }

  // 🔁 Backward continuous scan
  let cursor = new Date(today);
  cursor.setDate(cursor.getDate() - 1);

  while (true) {
    const dateStr = cursor.toISOString().split("T")[0];
    const exists = await Leave.findOne({
      userId,
      "date.fromDate": dateStr,
    });

    if (!exists) break;
    collectedDates.push(dateStr);
    cursor.setDate(cursor.getDate() - 1);
  }

  // ➕ Include today
  collectedDates.push(todayStr);

  // 🧹 Deduplicate & sort
  const uniqueDates = Array.from(new Set(collectedDates)).sort();

  const isLongContinuous = uniqueDates.length > 2;

  // --------------------------------
  // 2️⃣ Deduction order
  // --------------------------------
  const deductionOrder: LeaveKind[] = isLongContinuous
    ? ["paid", "casual", "unPaid"]
    : ["casual", "paid", "unPaid"];

  // --------------------------------
  // 3️⃣ Deduction helper
  // --------------------------------
  const deductLeave = (amount: number): LeaveDeduction => {
    const used: LeaveDeduction = {};
    let remaining = amount;

    for (const type of deductionOrder) {
      if (remaining <= 0) break;

      if (type === "casual" && casualLeaves > 0) {
        const d = Math.min(casualLeaves, remaining);
        casualLeaves -= d;
        remaining -= d;
        used.casual = (used.casual || 0) + d;
      }

      if (type === "paid" && paidLeaves > 0) {
        const d = Math.min(paidLeaves, remaining);
        paidLeaves -= d;
        remaining -= d;
        used.paid = (used.paid || 0) + d;
      }

      if (type === "unPaid" && remaining > 0) {
        unPaidLeaves += remaining;
        used.unPaid = (used.unPaid || 0) + remaining;
        remaining = 0;
      }
    }

    return used;
  };

  // --------------------------------
  // 4️⃣ Recalculate ALL dates
  // --------------------------------
  for (const dateStr of uniqueDates) {
    const existingLeave = await Leave.findOne({
      userId,
      "date.fromDate": dateStr,
    });

    const leaveAmount =
      dateStr === todayStr && leaveType === "half" ? 0.5 : 1;

    // 🔄 Refund old deductions
    if (existingLeave) {
      existingLeave.leaveTypes.forEach((lt: LeaveDeduction) => {
        casualLeaves += lt.casual || 0;
        paidLeaves += lt.paid || 0;
        unPaidLeaves -= lt.unPaid || 0;
      });
    }

    // ➖ Deduct fresh
    const used = deductLeave(leaveAmount);

    if (existingLeave) {
      existingLeave.dayType = [{
        halfDay: leaveAmount === 0.5 ? 1 : 0,
        fullDay: leaveAmount === 1 ? 1 : 0,
      }];
      existingLeave.leaveTypes = [used];
      await existingLeave.save();
    } else {
      await Leave.create({
        userId,
        date: [{ fromDate: new Date(dateStr), toDate: new Date(dateStr) }],
        dayType: [{
          halfDay: leaveAmount === 0.5 ? 1 : 0,
          fullDay: leaveAmount === 1 ? 1 : 0,
        }],
        leaveTypes: [used],
      });
    }
  }

  // --------------------------------
  // 5️⃣ Update balances once
  // --------------------------------
  await User.updateOne(
    { _id: userId, "leaves.year": currentYear },
    {
      $set: {
        "leaves.$.casualLeaves": casualLeaves,
        "leaves.$.paidLeaves": paidLeaves,
        "leaves.$.unPaidLeaves": unPaidLeaves,
      },
    }
  );
}

async function markShortLeave(
  userId: string,
  formattedDate: string,
  currentYear: number
) {
  const moment = (await import("moment-timezone")).default;

  // --------------------------------
  // 1️⃣ Idempotency: skip if short leave already recorded today
  // --------------------------------
  const todayStart = moment.tz(formattedDate, INDIA_TIMEZONE).startOf("day").toDate();
  const todayEnd = moment.tz(formattedDate, INDIA_TIMEZONE).endOf("day").toDate();

  const alreadyExists = await Leave.findOne({
    userId,
    "date.fromDate": { $gte: todayStart, $lte: todayEnd },
    "dayType.shortDay": 1,
  });

  if (alreadyExists) return;

  // --------------------------------
  // 2️⃣ Count existing short leaves this month (BEFORE adding today's)
  // --------------------------------
  const monthStart = moment.tz(formattedDate, INDIA_TIMEZONE).startOf("month").toDate();
  const monthEnd = moment.tz(formattedDate, INDIA_TIMEZONE).endOf("month").toDate();
  console.log('monthStart', monthStart, 'monthEnd', monthEnd)

  const existingShortLeavesThisMonth = await Leave.countDocuments({
    userId,
    "date.fromDate": { $gte: monthStart, $lte: monthEnd },
    "dayType.shortDay": 1,
  });
  console.log('existingShortLeavesThisMonth', existingShortLeavesThisMonth, ' userId:', userId)

  // --------------------------------
  // 3️⃣ Determine if this leave should deduct balance
  //    Only deduct if user already has 2+ short leaves this month (i.e. this is 3rd+)
  // --------------------------------
  const shouldDeduct = existingShortLeavesThisMonth >= 2;
  console.log('shouldDeduct', shouldDeduct, ' userId:', userId, ' formattedDate:', formattedDate)

  // --------------------------------
  // 4️⃣ Create short leave record
  // --------------------------------
  const newShortLeave = await Leave.create({
    userId,
    date: [{ fromDate: new Date(formattedDate), toDate: new Date(formattedDate) }],
    dayType: [{
      halfDay: shouldDeduct,
      fullDay: 0,
      shortDay: 1,
      shortDayConverted: shouldDeduct,
    }],
    leaveTypes: [{ casual: 0, paid: 0, unPaid: 0 }],
  });

  // --------------------------------
  // 5️⃣ No deduction for 1st and 2nd short leave → stop here
  // --------------------------------
  if (!shouldDeduct) return;

  console.log(`deduction for user:`, userId, " date:", new Date())

  // --------------------------------
  // 6️⃣ Deduct 0.5 from leave balance (casual → paid → unPaid)
  // --------------------------------
  const user = await User.findOne({
    _id: userId,
    "leaves.year": currentYear,
  }).lean<LeaveRecord>();

  if (!user) return;

  const leaveBalance = user.leaves.find((l) => l.year === currentYear);
  if (!leaveBalance) return;

  let { casualLeaves, paidLeaves, unPaidLeaves } = leaveBalance;
  let remaining = 0.5;
  const used = { casual: 0, paid: 0, unPaid: 0 };

  if (casualLeaves > 0) {
    const d = Math.min(casualLeaves, remaining);
    casualLeaves -= d;
    remaining -= d;
    used.casual = d;
  }

  if (remaining > 0 && paidLeaves > 0) {
    const d = Math.min(paidLeaves, remaining);
    paidLeaves -= d;
    remaining -= d;
    used.paid = d;
  }

  if (remaining > 0) {
    unPaidLeaves += remaining;
    used.unPaid = remaining;
    remaining = 0;
  }

  await User.updateOne(
    { _id: userId, "leaves.year": currentYear },
    {
      $set: {
        "leaves.$.casualLeaves": casualLeaves,
        "leaves.$.paidLeaves": paidLeaves,
        "leaves.$.unPaidLeaves": unPaidLeaves,
      },
    }
  );

  // update inserted leave record based on casual->paid->unpaid
  console.log('Deduction for user:', userId, 'Deduction breakdown:', used)
  await Leave.updateOne(
    { _id: newShortLeave._id },
    {
      $set: {
        leaveTypes: [used]
      }
    }
  );
}
