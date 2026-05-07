import { Router } from 'express';
import * as c0 from '@controllers/auth/forgetPassword/controller';
import * as c1 from '@controllers/auth/login/controller';
import * as c2 from '@controllers/auth/register/controller';
import * as c3 from '@controllers/auth/resetPassword/controller';

const router = Router();

router.post('/forgetPassword', c0.post);
router.post('/login', c1.post);
router.post('/register', c2.post);
router.post('/resetPassword', c3.post);

export default router;
