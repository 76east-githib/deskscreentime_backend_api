import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
// app/api/user-projects/route.js
import { getUserProjects } from '@helpers/userProjects';

export const post = asyncHandler(async (req: Request, res: Response) => {
  try {
    let { userId, page, per_page } = req.body;
    const { user, projectAllot } = await getUserProjects(userId, page, per_page);

    return res.status(200).json({ success: true, user, projectAllot });
  } catch (error) {
    console.log('error', error);
    return res.status(500).json({ success: false, message: 'Unable To reach server' });
  }
});
