import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./stats.handlers";
import * as routes from "./stats.routes";

const router = createRouter();

router.use("/api/apps/*/stats*", authMiddleware);
router.openapi(routes.getAppStats, handlers.getAppStats);
router.openapi(routes.getVersionDistribution, handlers.getVersionDistribution);
router.openapi(routes.getUpdateSuccessRate, handlers.getUpdateSuccessRate);

export default router;

