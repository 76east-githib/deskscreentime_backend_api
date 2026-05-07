import { Router } from 'express';
import * as c0 from '@controllers/superAdmin/delete-company/controller';
import * as c1 from '@controllers/superAdmin/delete-company/get-companies/controller';
import * as c2 from '@controllers/superAdmin/get-companies/controller';
import * as c3 from '@controllers/superAdmin/update-company-status/controller';

const router = Router();

router.delete('/delete-company', c0.del);
router.post('/delete-company/get-companies', c1.post);
router.post('/get-companies', c2.post);
router.post('/update-company-status', c3.post);

export default router;
