import { Router } from 'express';
import * as c0 from '@controllers/projectTask/add-task/controller';
import * as c1 from '@controllers/projectTask/delete-task/controller';
import * as c2 from '@controllers/projectTask/get-all-projects/controller';
import * as c3 from '@controllers/projectTask/get-project-tasks/controller';
import * as c4 from '@controllers/projectTask/get-task-detail/controller';
import * as c5 from '@controllers/projectTask/get-task-for-user/controller';
import * as c6 from '@controllers/projectTask/update-task/controller';

const router = Router();

router.post('/add-task', c0.post);
router.delete('/delete-task', c1.del);
router.post('/get-all-projects', c2.post);
router.post('/get-project-tasks', c3.post);
router.post('/get-task-detail', c4.post);
router.post('/get-task-for-user', c5.post);
router.post('/update-task', c6.post);

export default router;
