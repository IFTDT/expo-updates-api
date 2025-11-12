import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./versions.handlers";
import * as routes from "./versions.routes";

const router = createRouter();

router.use("/api/apps/*/versions", authMiddleware);
router.use("/api/apps/*/versions/*", authMiddleware);
router.openapi(routes.list, handlers.list);
router.openapi(routes.getOne, handlers.getOne);
router.openapi(routes.create, handlers.create);
router.openapi(routes.createFromUrl, handlers.createFromUrl);
router.openapi(routes.publish, handlers.publish);
router.openapi(routes.rollback, handlers.rollback);
router.openapi(routes.remove, handlers.remove);

export default router;
