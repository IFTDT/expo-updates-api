import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./user-groups.handlers";
import * as routes from "./user-groups.routes";

const router = createRouter();

router.use("/api/apps/*/user-groups", authMiddleware);
router.use("/api/apps/*/user-groups/*", authMiddleware);
router.openapi(routes.list, handlers.list);
router.openapi(routes.getOne, handlers.getOne);
router.openapi(routes.create, handlers.create);
router.openapi(routes.update, handlers.update);
router.openapi(routes.remove, handlers.remove);
router.openapi(routes.addUsers, handlers.addUsers);
router.openapi(routes.removeUsers, handlers.removeUsers);
router.openapi(routes.setTargetVersion, handlers.setTargetVersion);

export default router;
