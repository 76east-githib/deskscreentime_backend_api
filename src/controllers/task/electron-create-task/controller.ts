import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import User from '@models/User';
import Task from '@models/Task';
import connectDB from '@database/connect-db';
import { getCurrentIST } from '@utils/dateUtils';

// Define allowed statuses to ensure type safety
const allowedStatuses = [
  "todo",
  "pending",
  "in_progress",
  "testing",
  "review",
  "completed",
] as const;
type TaskStatus = (typeof allowedStatuses)[number];
interface RequestBody {
    taskName: string;
    userId: string;
    projectId?: string;
    companyId?: string;
    taskId?: string;
    taskDescription?: string;
    taskStatus?: TaskStatus;
}

interface CreateTaskParams {
    taskName: string;
    userId: string;
    projectId?: string;
    companyId?: string;
    taskDescription?: string;
    taskStatus?: TaskStatus;
}





export const post = asyncHandler(async (req: Request, res: Response) => {
    await connectDB();
    const { taskName, userId, projectId, companyId, taskId, taskDescription, taskStatus }: RequestBody = req.body;

    if (taskId && taskId.trim() !== '') {
        try {
            const task = await Task.findById(taskId);
            if (task) {
                // Check for existing active session for this user
                const existingActiveSession = task.sessions?.find(
                    (session: any) =>
                        session.userId?.toString() === userId &&
                        session.status === 'active' &&
                        !session.endTime
                );

                if (existingActiveSession) {
                    return res.status(400).json({
                        success: false,
                        message: 'You already have an active session for this task. Please stop it before starting a new one.',
                    });
                }

                // Use IST timezone for consistent time tracking
                const sessionStartTime = getCurrentIST();
                const newSession = {
                    startTime: sessionStartTime,
                    endTime: null, // Should be null for active sessions, not same as startTime
                    userId: userId,
                    status: "active",
                    taskDescription: taskDescription || '',
                    taskDescriptionStatus: taskStatus || "todo"
                };

                task.sessions.push(newSession);
                // ✅ Safely update status only if valid
                if (taskStatus && allowedStatuses.includes(taskStatus)) {
                    task.taskStatus = taskStatus;
                }
                await task.save();
                return res.status(200).json({
                    success: true,
                    message: 'Timer started successfully',
                    data: task,
                });
            } else {
                return createNewTask(res, { taskName, userId, projectId, companyId, taskDescription, taskStatus });
            }
        } catch (error) {
            console.error('Error creating task session:', error);
            return res.status(500).json({
                success: false,
                message: 'Server encountered some error',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    } else {
        return createNewTask(res, { taskName, userId, projectId, companyId, taskDescription, taskStatus });
    }
});

async function createNewTask(res: Response, {
    taskName,
    userId,
    projectId,
    companyId,
    taskDescription,
    taskStatus
}: CreateTaskParams) {
    if (!taskName || !userId) {
        return res.status(400).json({
            success: false,
            message: 'Task name and user ID are required',
        });
    }

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: 'Project ID is required',
        });
    }

    try {
        // Check for existing active session for this user and project
        const existingTask = await Task.findOne({
            userIds: userId,
            projectId: projectId,
            'sessions.userId': userId,
            'sessions.status': 'active',
            'sessions.endTime': null,
        });

        if (existingTask) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active session. Please stop it before starting a new task.',
            });
        }

        // Use IST timezone for consistent time tracking
        const taskStartTime = getCurrentIST();
        const sessionStartTime = getCurrentIST();
        
        const task = {
            taskName: taskName,
            userIds: [userId],
            startTime: taskStartTime,
            projectId: projectId,
            companyId: companyId,
            taskStatus: taskStatus && allowedStatuses.includes(taskStatus) ? taskStatus : 'todo',
            sessions: [{
                userId: userId,
                startTime: sessionStartTime,
                endTime: null,
                status: 'active',
                taskDescription: taskDescription || '',
                taskDescriptionStatus: taskStatus || 'todo',
            }],
        };

        const taskCreated = await Task.create(task);
        if (taskCreated) {
            return res.status(200).json({
                success: true,
                message: 'Task created and timer started successfully',
                data: taskCreated,
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Unable to create task, please try again',
            });
        }
    } catch (error) {
        console.error('Error creating new task:', error);
        return res.status(500).json({
            success: false,
            message: 'Server encountered an error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
