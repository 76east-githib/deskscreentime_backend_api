import { Router } from 'express';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import commonRoutes from './common.routes';
import projectTaskRoutes from './projectTask.routes';
import superAdminRoutes from './superAdmin.routes';
import taskRoutes from './task.routes';

const router = Router();
router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/common', commonRoutes);
router.use('/projectTask', projectTaskRoutes);
router.use('/superAdmin', superAdminRoutes);
router.use('/task', taskRoutes);

export default router;
