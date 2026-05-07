import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Task from "@models/Task";
import User from "@models/User";
import connectDB from "@database/connect-db";
import { htmlReport } from "@helpers/mailHtml";
import moment from "moment-timezone";
import { sendEmail } from "@helpers/sendMail";
import { getYesterdayISTString, getISTDateRangeForQuery } from "@utils/dateUtils";

const INDIA_TIMEZONE = 'Asia/Kolkata';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  try {
    const yesterdayDate = getYesterdayISTString();
    const { start, end } = getISTDateRangeForQuery(yesterdayDate);
    const date = yesterdayDate;

    // Get companies, subCompAdmins, and users
    const allRecipients = await User.find({
      $or: [
        { role: "company" },
        { role: "subCompAdmin" },
        { role: "user" }
      ],
      status: "active" // Only active users
    });

    if (allRecipients && allRecipients.length) {
      for (let i = 0; i < allRecipients.length; i++) {
        const recipient = allRecipients[i];
        
        // Determine the correct companyId and userId filter
        let companyId;
        let userIdFilter = null; // null means all users of company
        
        if (recipient.role === "subCompAdmin") {
          companyId = recipient.companyId;
          userIdFilter = null; // subCompAdmin gets full company report
        } else if (recipient.role === "company") {
          companyId = recipient._id;
          userIdFilter = null; // company gets full company report
        } else if (recipient.role === "user") {
          companyId = recipient.companyId;
          userIdFilter = recipient._id; // user gets only their own report
        }

        try {
          const promises = [
            getEmployeeWiseData(companyId, date, start, end, userIdFilter),
            getProjectWiseData(companyId, date, start, end, userIdFilter),
          ];

          const [employeeData, projectData] = await Promise.all(promises);
          console.log('employeeData', employeeData);
          console.log('projectData', projectData);

          // Check if there's any actual data before sending email
          const hasEmployeeData = employeeData && employeeData !== "" && (employeeData as string).includes("<tr");
          const hasProjectData = projectData && projectData !== "" && (projectData as string).includes("<tr");

          // Only send email if there's at least some data
          if (hasEmployeeData || hasProjectData) {
            const EmailData = htmlReport
              .replace(
                /#date#/g,
                moment.tz(date, INDIA_TIMEZONE).format("DD-MMM-YYYY")
              )
              .replace(
                /#body#/g,
                ((projectData || "") + (employeeData || "")) as string
              );

            await sendEmail(
              `Desk Screen Time Summary Report ${moment(date, "YYYY-MM-DD").format("DD-MMM-YYYY")}`,
              recipient.email,
              EmailData
            );

            console.log(`Mail sent to ${recipient.role}: ${recipient.email}`);
          } else {
            console.log(`No data for ${recipient.email} (${recipient.role}), skipping email`);
          }
        } catch (error) {
          console.error(`Error sending mail to ${recipient.email} (${recipient.role}):`, error);
        }
      }
    }

    return res.status(200).json({ success: true, message: "Mail report sent" });
  } catch (error) {
    console.log("Error send Mail:", error);
    return res.status(500).json({
        success: false,
        message: "Server encountered some error",
        error: error,
      });
  }
});

async function getEmployeeWiseData(
  compId: any, 
  date: any, 
  start: any, 
  end: any, 
  userIdFilter: any = null
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Build match criteria for sessions overlapping the target day
      const matchCriteria: any = {
        $and: [
          { "sessions.startTime": { $lt: new Date(end) } },
          { 
            $or: [
              { "sessions.endTime": { $gt: new Date(start) } },
              { "sessions.endTime": null }
            ] 
          },
          { companyId: compId },
        ],
      };

      // If userIdFilter is provided, add it to match criteria
      if (userIdFilter) {
        matchCriteria.$and.push({ "sessions.userId": userIdFilter });
      }

      const user_duration1 = await Task.aggregate([
        { $match: matchCriteria },
        { $unwind: "$sessions" },
        {
          $match: {
            "sessions.startTime": { $lt: new Date(end) },
            $or: [
              { "sessions.endTime": { $gt: new Date(start) } },
              { "sessions.endTime": null }
            ],
            ...(userIdFilter && { "sessions.userId": userIdFilter })
          },
        },
        {
          $addFields: {
            effectiveStartTime: {
              $cond: [
                { $lt: ["$sessions.startTime", new Date(start)] },
                new Date(start),
                "$sessions.startTime"
              ]
            },
            effectiveEndTime: {
              $cond: [
                { $or: [
                  { $eq: ["$sessions.endTime", null] },
                  { $gt: ["$sessions.endTime", new Date(end)] }
                ]},
                new Date(end),
                "$sessions.endTime"
              ]
            }
          }
        },
        {
          $addFields: {
            duration: { $subtract: ["$effectiveEndTime", "$effectiveStartTime"] },
            sessionTotalDuration: { 
              $subtract: [
                { $ifNull: ["$sessions.endTime", new Date()] }, 
                "$sessions.startTime" 
              ] 
            }
          }
        },
        {
          $project: {
            userId: "$sessions.userId",
            projectId: "$projectId",
            duration: "$duration",
            _id: "$_id",
            idleTime: {
              $cond: [
                { $gt: ["$sessionTotalDuration", 0] },
                { 
                  $multiply: [
                    { $ifNull: ["$sessions.idleTime", 0] }, 
                    { $divide: ["$duration", "$sessionTotalDuration"] }
                  ] 
                },
                { $ifNull: ["$sessions.idleTime", 0] }
              ]
            },
            startTime: "$effectiveStartTime",
            endTime: "$effectiveEndTime",
            taskName: "$taskName",
            taskDescription: "$sessions.taskDescription",
            taskDescriptionStatus: "$sessions.taskDescriptionStatus",
            taskStatus: "$taskStatus",
          },
        },
        {
          $lookup: {
            from: "projects",
            localField: "projectId",
            foreignField: "_id",
            as: "projects",
          },
        },
        { $unwind: "$projects" },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: "$userInfo" },
        {
          $project: {
            userId: "$userId",
            projectId: "$projectId",
            idleTime: "$idleTime",
            duration: "$duration",
            projectName: "$projects.projectName",
            username: "$userInfo.fullname",
            startTime: "$startTime",
            endTime: "$endTime",
            taskName: "$taskName",
            taskDescription: { $ifNull: ["$taskDescription", "—"] },
            taskDescriptionStatus: { $ifNull: ["$taskDescriptionStatus", "—"] },
            taskStatus: "$taskStatus",
          },
        },
        {
          $group: {
            _id: "$userId",
            userId: { $first: "$userId" },
            fullName: { $first: "$username" },
            activeTime: { $sum: "$duration" },
            idleTime: { $sum: "$idleTime" },
            sessions: {
              $push: {
                projectName: "$projectName",
                taskName: "$taskName",
                taskDescription: "$taskDescription",
                taskDescriptionStatus: "$taskDescriptionStatus",
                startTime: "$startTime",
                endTime: "$endTime",
                taskStatus: "$taskStatus",
              },
            },
          },
        },
      ]);

      // If no data, return empty string
      if (!user_duration1 || user_duration1.length === 0) {
        resolve("");
        return;
      }

      const temp2 = user_duration1.reduce(function (r: any, a: any) {
        const userId = a.userId.toString();
        r[userId] = r[userId] || [];
        r[userId].push(a);
        return r;
      }, Object.create(null));

      const temp2Array = Object.entries(temp2);
      temp2Array.sort((a, b) => (a[0] as string).localeCompare(b[0] as string));

      const sortedTemp2 = temp2Array.reduce((acc: any, [key, value]) => {
        acc[key] = value;
        return acc;
      }, Object.create(null));

      let employeeTable = "";
      employeeTable += `<div style="overflow-x: auto; margin: 20px 0; max-width: 100%;">
        <table border='1' style='border-collapse:collapse; width: 100%; border: 1px solid #ddd; font-size: 12px;'>
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th colspan="10" style="text-align: center; font-weight: bold; padding: 10px; border: 1px solid #ddd;">Team Report</th>
          </tr>
          <tr style="background-color: #e8e8e8;">
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 10%;">Employee</th>
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 12%;">Project</th>
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 10%;">Task</th>
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 18%;">Task Description</th>
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 8%;">Status</th>
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 10%;">Start Time</th>
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 10%;">Stop Time</th>
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 8%;">Total time</th>
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 8%;">Active Time</th>
            <th style="padding: 6px 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 8%;">Idle Time</th>
          </tr>
        </thead>
        <tbody>`;

      Object.entries(sortedTemp2).forEach(([key, value]: [string, any]) => {
        const object = value[0];
        
        const activeTimeSum = value.reduce(
          (sum: number, sess: any) => sum + sess.activeTime,
          0
        );
        const idleTimeSum = value.reduce(
          (sum: number, sess: any) => sum + sess.idleTime,
          0
        );

        const diff = activeTimeSum - idleTimeSum;
        const activeTime = new Date(diff).toISOString().slice(11, 16);
        const idleTime = new Date(idleTimeSum).toISOString().slice(11, 16);

        // Collect all unique sessions
        const allSessions: any[] = [];
        value.forEach((item: any) => {
          item.sessions.forEach((session: any) => {
            const exists = allSessions.some(
              (s: any) => s.taskDescription === session.taskDescription &&
                          s.startTime === session.startTime
            );
            if (!exists) {
              allSessions.push(session);
            }
          });
        });
        console.log('--getEmployeeWiseData-allSessions', allSessions);

        const totalRows = allSessions.length;

        allSessions.forEach((s: any, idx: number) => {
          employeeTable += `<tr style="text-align:center;">
            ${idx === 0 ? `<td rowspan="${totalRows}" style="padding:6px 8px; border: 1px solid #ddd; vertical-align: middle; word-wrap: break-word; max-width: 100px;">${object.fullName}</td>` : ''}
            <td style="padding:6px 8px; border: 1px solid #ddd; word-wrap: break-word; max-width: 120px;">${s.projectName}</td>
            <td style="padding:6px 8px; border: 1px solid #ddd; word-wrap: break-word; max-width: 100px;">${s.taskName}</td>
            <td style="padding:6px 8px; border: 1px solid #ddd; word-wrap: break-word; text-align: left; max-width: 150px;">${s.taskDescription || "—"}</td>
            <td style="padding:6px 8px; border: 1px solid #ddd; font-size: 11px;">${s.taskStatus || "—"}</td>
            <td style="padding:6px 8px; border: 1px solid #ddd; white-space: nowrap; font-size: 11px;">${moment(s.startTime).tz("Asia/Kolkata").format("hh:mm A")}</td>
            <td style="padding:6px 8px; border: 1px solid #ddd; white-space: nowrap; font-size: 11px;">${moment(s.endTime).tz("Asia/Kolkata").format("hh:mm A")}</td>
            <td style="padding:6px 8px; border: 1px solid #ddd; white-space: nowrap; font-size: 11px;">${new Date(s.endTime - s.startTime).toISOString().slice(11, 16)}</td>
            ${idx === 0 ? `<td rowspan="${totalRows}" style="padding:6px 8px; border: 1px solid #ddd; vertical-align: middle; white-space: nowrap; font-size: 11px;">${activeTime}</td>` : ''}
            ${idx === 0 ? `<td rowspan="${totalRows}" style="padding:6px 8px; border: 1px solid #ddd; vertical-align: middle; white-space: nowrap; font-size: 11px;">${idleTime}</td>` : ''}
          </tr>`;
        });
      });

      employeeTable += `</tbody></table></div>`;
      resolve(employeeTable);
    } catch (error) {
      console.error("Error in getEmployeeWiseData:", error);
      resolve("");
    }
  });
}

async function getProjectWiseData(
  compId: any, 
  date: any, 
  start: any, 
  end: any, 
  userIdFilter: any = null
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Build match criteria for sessions overlapping the target day
      const matchCriteria: any = {
        $and: [
          { "sessions.startTime": { $lt: new Date(end) } },
          { 
            $or: [
              { "sessions.endTime": { $gt: new Date(start) } },
              { "sessions.endTime": null }
            ] 
          },
          { companyId: compId },
        ],
      };

      // If userIdFilter is provided, add it to match criteria
      if (userIdFilter) {
        matchCriteria.$and.push({ "sessions.userId": userIdFilter });
      }

      const query1: any[] = [
        { $match: matchCriteria },
        { $unwind: "$sessions" },
        {
          $match: {
            "sessions.startTime": { $lt: new Date(end) },
            $or: [
              { "sessions.endTime": { $gt: new Date(start) } },
              { "sessions.endTime": null }
            ],
            ...(userIdFilter && { "sessions.userId": userIdFilter })
          },
        },
        {
          $addFields: {
            effectiveStartTime: {
              $cond: [
                { $lt: ["$sessions.startTime", new Date(start)] },
                new Date(start),
                "$sessions.startTime"
              ]
            },
            effectiveEndTime: {
              $cond: [
                { $or: [
                  { $eq: ["$sessions.endTime", null] },
                  { $gt: ["$sessions.endTime", new Date(end)] }
                ]},
                new Date(end),
                "$sessions.endTime"
              ]
            }
          }
        },
        {
          $lookup: {
            from: "projects",
            localField: "projectId",
            foreignField: "_id",
            as: "projectDetail",
          },
        },
        { $unwind: "$projectDetail" },
        { $sort: { startTime: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "userIds",
            foreignField: "_id",
            as: "userDetails",
          },
        },
      ];

      const result1 = await Task.aggregate(query1);

      // If no data, return empty string
      if (!result1 || result1.length === 0) {
        resolve("");
        return;
      }

      const mod = result1.map((item) => ({
        _id: item._id,
        userId: item.userId,
        taskName: item.taskName,
        projectId: item.projectId,
        startTime: item.effectiveStartTime,
        endTime: item.effectiveEndTime,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        projectName: item.projectDetail.projectName,
        userName: item.userDetails?.map((user: any) => user.fullname).join(", ") || "Unknown User",
      }));

      const temp = mod.reduce(function (r: any, a: any) {
        r[a.projectName] = r[a.projectName] || [];
        r[a.projectName].push(a);
        return r;
      }, Object.create(null));

      const tempArray = Object.entries(temp);
      tempArray.sort((a, b) => (a[0] as string).localeCompare(b[0] as string));

      const sortedTemp1 = tempArray.reduce((acc: any, [key, value]) => {
        acc[key] = value;
        return acc;
      }, Object.create(null));

      const perProjectUserTotalTime: any[] = [];
      const promises = Object.entries(sortedTemp1).map(
        async ([key, value]: [string, any]) => {
          const time: any = await totalTimePerProject(value);
          perProjectUserTotalTime.push(time.totalTime);
        }
      );
      await Promise.all(promises);

      const structForProject: any[] = [];
      Object.entries(sortedTemp1).forEach(([key, value]: [string, any], index) => {
        const temObj = {
          projectName: key,
          userName: value[0].userName,
          userDurationPerProject: perProjectUserTotalTime[index],
        };
        structForProject.push(temObj);
      });
      console.log('--getProjectWiseData-structForProject', structForProject);

      let projectWiseTable = "";
      projectWiseTable += `<div style="overflow-x: auto; margin: 20px 0; max-width: 100%;">
        <table border='1' style='border-collapse:collapse; width: 100%; border: 1px solid #ddd;'>
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th colspan="2" style="text-align: center; font-weight: bold; font-size: 16px; padding: 12px; border: 1px solid #ddd;">
              Projects Summary
            </th>
          </tr>
          <tr style="background-color: #e8e8e8;">
            <th style="padding: 8px 12px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 70%;">Project</th>
            <th style="padding: 8px 12px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 30%;">Total Time</th>
          </tr>
        </thead>
        <tbody>`;

      structForProject.forEach((item: any) => {
        projectWiseTable += `<tr style="text-align: center;">
          <td style="padding: 8px 12px; border: 1px solid #ddd; word-wrap: break-word; overflow-wrap: break-word;">${item.projectName}</td>
          <td style="padding: 8px 12px; border: 1px solid #ddd;">${item.userDurationPerProject}</td>
        </tr>`;
      });

      projectWiseTable += `</tbody></table></div><br><br>`;
      resolve(projectWiseTable);
    } catch (error) {
      console.error("Error in getProjectWiseData:", error);
      resolve("");
    }
  });
}

function totalTimePerProject(params: any): Promise<{ totalTime: string; startDate: Date }> {
  return new Promise((resolve, reject) => {
    const startedDate = new Date(
      Math.min(...params.map((e: any) => new Date(e.startTime).getTime()))
    );

    let total_time: any = params
      .map((val: any) => {
        const enddate = new Date(val.endTime).getTime();
        const startdate = new Date(val.startTime).getTime();
        return enddate - startdate;
      })
      .reduce(
        (accumulator: number, currentValue: number) => accumulator + currentValue,
        0
      );

    if (total_time) {
      total_time = new Date(total_time).toISOString().substr(11, 5);
    }

    const sendObj = {
      totalTime: total_time,
      startDate: startedDate,
    };

    resolve(sendObj);
  });
}