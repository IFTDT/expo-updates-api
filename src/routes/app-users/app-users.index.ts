import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./app-users.handlers";
import * as routes from "./app-users.routes";

const router = createRouter();

router.use("/api/apps/*/users*", authMiddleware);
router.openapi(routes.list, handlers.list);
router.openapi(routes.getOne, handlers.getOne);
router.openapi(routes.updateVersion, handlers.updateVersion);
router.openapi(routes.batchUpdate, handlers.batchUpdate);
router.openapi(routes.rollback, handlers.rollback);

export default router;

