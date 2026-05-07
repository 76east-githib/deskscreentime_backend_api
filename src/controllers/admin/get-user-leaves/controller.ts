import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
// import Leave from "@models/Leave";
// import User from "@models/User";
// import { NextResponse } from "next/server";
// import mongoose from "mongoose";

// export async function POST(req: Request) {
//   const { userId,selectedMonth,selectedYear } = req.body;
//   try {
//     const currentYear = new Date().getFullYear();
//     console.log("currentYear----->>>", currentYear);
//     const startDate = new Date(`${currentYear}-01-01T00:00:00.000Z`);
//     const endDate = new Date(`${currentYear}-12-31T23:59:59.999Z`);
//     console.log("startDate--->", startDate);
//     console.log("endDate---->", endDate);
//     const leaveRecords = await Leave.find({
//       userId: new mongoose.Types.ObjectId(userId),
//       "date.fromDate": {
//         $gte: startDate,
//         $lte: endDate,
//       },
//     });
//     console.log("leaveRecords----->", leaveRecords);

//     // Find the total count of unpaid leaves in the leave records
//     const currentMonth = new Date().getMonth(); // Get the current month (0-based index)
//     console.log("currentYear----->>>", currentYear);

//     const startMponthDate = await new Date(currentYear, currentMonth, 1); // Start of the current month
//     const endMpnthDate = await new Date(currentYear, currentMonth + 1, 0); // End of the current month

//     console.log("startMponthDate--->", startMponthDate);
//     console.log("endMpnthDate---->", endMpnthDate);

//     const leavesData = await Leave.find({
//       userId: new mongoose.Types.ObjectId(userId),
//       "date.fromDate": {
//         $gte: startMponthDate,
//         $lte: endMpnthDate,
//       },
//     });
//     console.log("leavesData------>", leavesData);

//     // Find the total count of unpaid leaves in the current month
//     let totalUnPaidLeaves = 0;
//     leaveRecords.forEach((record) => {
//       record.leaveTypes.forEach((leaveType: any) => {
//         totalUnPaidLeaves += leaveType.unPaid || 0; // Sum up all unpaid leaves for the current month
//       });
//     });
//     console.log("Total Unpaid Leaves for current month:", totalUnPaidLeaves);
//     const userDetails = await User.findOne(
//       { _id: userId },
//       { leaves: { $elemMatch: { year: currentYear } } }
//     );
//     console.log("userDetails--->>", userDetails);

//     return NextResponse.json(
//       { success: true, leaveRecords, userDetails, totalUnPaidLeaves },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("Error fetching leave details: ", error);
//     return NextResponse.json(
//       { success: false, message: "Unable to get leave details" },
//       { status: 500 }
//     );
//   }
// }

import Leave from "@models/Leave";
import User from "@models/User";
import mongoose from "mongoose";

export const post = asyncHandler(async (req: Request, res: Response) => {
  const { userId, selectedMonth, selectedYear } = req.body;
  console.log("userId------__>>", userId);
  console.log("selectedMonth---->>", selectedMonth);
  console.log("selectedYear---->", selectedYear);
  try {
    // const startDate = new Date(`${selectedYear}-01-01T00:00:00.000Z`);
    // const endDate = new Date(`${selectedYear}-12-31T23:59:59.999Z`);
    // console.log("startDate--->", startDate);
    // console.log("endDate---->", endDate);
    // const leaveRecords = await Leave.find({
    //   userId: new mongoose.Types.ObjectId(userId),
    //   "date.fromDate": {
    //     $gte: startDate,
    //     $lte: endDate,
    //   },
    // });
    // console.log("leaveRecords by year----->", leaveRecords);

    // Mapping month names to their numeric values
    const monthMap: { [key: string]: string } = {
      January: "01",
      February: "02",
      March: "03",
      April: "04",
      May: "05",
      June: "06",
      July: "07",
      August: "08",
      September: "09",
      October: "10",
      November: "11",
      December: "12",
    };

    // Get the formatted month from the map
    const formattedMonth = monthMap[selectedMonth] || "01"; // Default to January if not found
    console.log("formattedMonth---------__>>>>", formattedMonth);

    // const startMponthDate = new Date(
    //   `${selectedYear}-${formattedMonth}-01T00:00:00.000Z`
    // ); // Start of the current month
    // const endMpnthDate = new Date(
    //   `${selectedYear}-${formattedMonth}-31T23:59:59.999Z`
    // ); // End of the current month

    const formattedMonthIndex = parseInt(monthMap[selectedMonth]) - 1;
    const startMponthDate = new Date(Date.UTC(selectedYear, formattedMonthIndex, 1, 0, 0, 0, 0));
    const endMpnthDate = new Date(Date.UTC(selectedYear, formattedMonthIndex + 1, 1, 0, 0, 0, 0) - 1);

    console.log("startMponthDate--->", startMponthDate);
    console.log("endMpnthDate---->", endMpnthDate);

    const leavesData = await Leave.find({
      userId: new mongoose.Types.ObjectId(userId),
      "date.fromDate": {
        $gte: startMponthDate,
        $lte: endMpnthDate,
      },
    });
    console.log("leavesData of month ------>", leavesData);

    // Calculate the total count of unpaid leaves in the current month
    let totalUnPaidLeaves = 0;
    leavesData.forEach((record) => {
      record.leaveTypes.forEach((leaveType: any) => {
        totalUnPaidLeaves += leaveType.unPaid || 0; // Sum up all unpaid leaves for the current month
      });
    });
    console.log("Total Unpaid Leaves for current month:", totalUnPaidLeaves);

    const userDetails = await User.findOne(
      { _id: userId },
      { leaves: { $elemMatch: { year: selectedYear } } }
    );
    console.log("userDetails--->>", userDetails);

    return res.status(200).json({
        success: true,
        leaveRecords: leavesData,
        userDetails,
        totalUnPaidLeaves,
      });
  } catch (error) {
    console.error("Error fetching leave details: ", error);
    return res.status(500).json({ success: false, message: "Unable to get leave details" });
  }
});
