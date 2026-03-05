import { Router } from 'express';
import { loginRouter } from './login.js';

export const authRouter = Router();

authRouter.use(loginRouter);
