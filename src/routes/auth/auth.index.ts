import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./auth.handlers";
import * as routes from "./auth.routes";

const router = createRouter();

// 登录和刷新Token不需要认证
router.openapi(routes.login, handlers.login);
router.openapi(routes.refresh, handlers.refresh);

// 需要认证的接口
router.use("/api/auth/logout", authMiddleware);
router.use("/api/auth/me", authMiddleware);
router.openapi(routes.logout, handlers.logout);
router.openapi(routes.getMe, handlers.getMe);

export default router;

