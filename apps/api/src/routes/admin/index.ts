import { Router } from "express";
import { requireAdmin, requireAuth } from "../../auth/session.js";
import { adminsRouter } from "./admins.js";
import { settingsRouter } from "./settings.js";
import { studentsRouter } from "./students.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.use(studentsRouter, adminsRouter, settingsRouter);
