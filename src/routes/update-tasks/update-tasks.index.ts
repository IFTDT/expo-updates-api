import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./update-tasks.handlers";
import * as routes from "./update-tasks.routes";

const router = createRouter();

router.use("/api/apps/*/update-tasks", authMiddleware);
router.use("/api/apps/*/update-tasks/*", authMiddleware);
router.openapi(routes.list, handlers.list);
router.openapi(routes.getOne, handlers.getOne);
router.openapi(routes.create, handlers.create);

export default router;

