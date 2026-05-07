import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from "@models/User";
import Project from "@models/Project";
import Task from "@models/Task";
import connectDB from "@database/connect-db";
import type { CustomUser } from "@auth/types";

export const dynamic = "force-dynamic"; // Prevent static optimization
import { Types } from "mongoose";

interface PopulatedProject {
  _id: Types.ObjectId;
  projectName: string;
}

interface TaskLean {
  _id: Types.ObjectId;
  taskName: string;
  taskStatus: string;
  sessions: {
    startTime?: Date;
    endTime?: Date;
    status?: string;
  }[];
  projectId?: PopulatedProject | Types.ObjectId | null;
}



export const get = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  try {
    // Extract the token using the correct request type
    const token = ({ user: (req as any).user });
    const user: CustomUser | null = token?.user as CustomUser;

    if (user?.role == 'company' || user?.role == 'subCompAdmin') {
      const companyId = user?.role == 'company' ? user._id : user.companyId;
      const [totalEmployees, totalProjects, recentTasks] = await Promise.all([
        User.countDocuments({ companyId }),
        Project.countDocuments({ companyId }),
        Task.find({
          companyId,
          "sessions.status": { $in: ["ended", "crashed"] }
        })
          .sort({ updatedAt: -1 })
          .limit(4)
          .populate('userIds', 'name')
          .populate('projectId', 'projectName')
          .select('taskName taskStatus sessions projectId updatedAt')
          .lean() as unknown as TaskLean[]
      ]);


      // Get date utilities for latest day calculation
      const { getStartOfDayIST, getEndOfDayIST } = await import("@utils/dateUtils");

      const formattedTasks = recentTasks.map(task => {
        // 1. Find the latest session date among ended/crashed sessions
        let latestDateMs = 0;
        task.sessions?.forEach(session => {
          if (session.startTime && ["ended", "crashed"].includes(session.status || '')) {
            const sessionDateMs = new Date(session.startTime).getTime();
            if (sessionDateMs > latestDateMs) latestDateMs = sessionDateMs;
          }
        });

        const latestDayStart = latestDateMs ? getStartOfDayIST(new Date(latestDateMs)) : null;
        const latestDayEnd = latestDateMs ? getEndOfDayIST(new Date(latestDateMs)) : null;

        const totalMs = task.sessions?.reduce((total, session) => {
          if (!session.startTime || !session.endTime || !["ended", "crashed"].includes(session.status || '')) return total;

          const start = new Date(session.startTime);
          const end = new Date(session.endTime);

          // 2. Only count sessions from that latest day
          if (latestDayStart && latestDayEnd && start >= latestDayStart && start <= latestDayEnd) {
            return total + (end.getTime() - start.getTime());
          }

          return total;
        }, 0) || 0;

        // Convert milliseconds
        const seconds = Math.floor((totalMs / 1000) % 60);
        const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
        const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
        const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));

        let timeString = '';
        if (days > 0) timeString += `${days}d `;
        if (hours > 0 || days > 0) timeString += `${hours}h `;
        if (minutes > 0 || hours > 0 || days > 0) timeString += `${minutes}m `;
        timeString += `${seconds}s`;

        return {
          id: task._id,
          title: task.taskName,
          status: task.taskStatus,
          projectName: task.projectId && typeof task.projectId === 'object' && 'projectName' in task.projectId ? task.projectId.projectName : '',
          timeSpent: totalMs,      // ✅ only today's time
          timeString: timeString.trim()
        };
      });


      return res.status(200).json({
          success: true,
          message: "Data fetched successfully.",
          data: {
            totalEmployees,
            totalProjects,
            recentTasks: formattedTasks
          }
        });
    } else {
      return res.status(200).json({
          success: true,
          message: "Data fetched successfully.",
          data: {}
        });
    }
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({ success: false, message: "Unable to get dashboard data due to an error." });
  }
});
