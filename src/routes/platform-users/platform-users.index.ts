import { createRouter } from "@/lib/create-app";
import { adminMiddleware, authMiddleware } from "@/middlewares/auth";

import * as handlers from "./platform-users.handlers";
import * as routes from "./platform-users.routes";

const router = createRouter();

// 应用认证和权限中间件到所有用户相关路由
router.use("/api/users", authMiddleware, adminMiddleware);
router.use("/api/users/*", authMiddleware, adminMiddleware);
router.openapi(routes.list, handlers.list);
router.openapi(routes.create, handlers.create);
router.openapi(routes.update, handlers.update);
router.openapi(routes.remove, handlers.remove);
router.openapi(routes.resetPassword, handlers.resetPassword);
router.openapi(routes.toggleStatus, handlers.toggleStatus);

export default router;
