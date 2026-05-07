import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import { getUserData } from "@helpers/getUsersData";
import connectDB from "@database/connect-db";

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  try {
    const data = req.body;
    const { userInProject, user_duration } = await getUserData(data);

    if (data.startDate && data.endDate) {
      return res.status(200).json({
          success: true,
          userInProject,
          user_duration,
        });
    } else {
      return res.status(200).json({ success: true, users: userInProject });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable To Get Notifications" });
  }
});
