import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./logs.handlers";
import * as routes from "./logs.routes";

const router = createRouter();

router.use("/api/apps/*/logs*", authMiddleware);
router.openapi(routes.list, handlers.list);
router.openapi(routes.getOne, handlers.getOne);
router.openapi(routes.exportLogs, handlers.exportLogs);

export default router;

