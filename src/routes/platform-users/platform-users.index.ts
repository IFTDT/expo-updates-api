import { createRouter } from "@/lib/create-app";
import { authMiddleware, adminMiddleware } from "@/middlewares/auth";

import * as handlers from "./platform-users.handlers";
import * as routes from "./platform-users.routes";

const router = createRouter();

router.use("/api/users*", authMiddleware);
router.use("/api/users*", adminMiddleware);
router.openapi(routes.list, handlers.list);
router.openapi(routes.create, handlers.create);
router.openapi(routes.update, handlers.update);
router.openapi(routes.remove, handlers.remove);
router.openapi(routes.resetPassword, handlers.resetPassword);
router.openapi(routes.toggleStatus, handlers.toggleStatus);

export default router;

