import { createRouter } from "@/lib/create-app";

import * as handlers from "./admin.handlers";
import * as routes from "./admin.routes";

const router = createRouter();

// 创建管理员不需要认证（特殊接口）
router.openapi(routes.createAdmin, handlers.createAdmin);

export default router;
