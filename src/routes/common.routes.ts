import { Router } from 'express';
import * as c0 from '@controllers/common/add-bank-details/controller';
import * as c1 from '@controllers/common/change-password/controller';
import * as c2 from '@controllers/common/create-leave-for-user/controller';
import * as c3 from '@controllers/common/dashboard-data/controller';
import * as c4 from '@controllers/common/delete-additional-leave/controller';
import * as c5 from '@controllers/common/get-additional-leaves/controller';
import * as c6 from '@controllers/common/get-userData/controller';
import * as c7 from '@controllers/common/month-wise-leaves/controller';
import * as c8 from '@controllers/common/send-client-excel/controller';
import * as c9 from '@controllers/common/update-profile/controller';
import { memoryUpload } from '@middleware/upload';

const router = Router();

router.post('/add-bank-details', c0.post);
router.post('/change-password', c1.post);
router.post('/create-leave-for-user', c2.post);
router.get('/dashboard-data', c3.get);
router.delete('/delete-additional-leave', c4.del);
router.post('/get-additional-leaves', c5.post);
router.post('/get-userData', c6.post);
router.post('/month-wise-leaves', c7.post);
router.post('/send-client-excel', memoryUpload.single('file'), c8.post);
router.post('/update-profile', c9.post);

export default router;
