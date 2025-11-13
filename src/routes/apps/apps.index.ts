import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./apps.handlers";
import * as routes from "./apps.routes";

const router = createRouter();

router.use("/api/apps", authMiddleware);
router.use("/api/apps/*", authMiddleware);
router.openapi(routes.list, handlers.list);
router.openapi(routes.getOne, handlers.getOne);
router.openapi(routes.create, handlers.create);
router.openapi(routes.update, handlers.update);
router.openapi(routes.remove, handlers.remove);
router.openapi(routes.setCurrentVersion, handlers.setCurrentVersion);

export default router;
