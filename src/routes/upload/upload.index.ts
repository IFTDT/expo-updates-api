import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./upload.handlers";
import * as routes from "./upload.routes";

const router = createRouter();

router.use("/api/upload", authMiddleware);
router.use("/api/upload/*", authMiddleware);
router.openapi(routes.upload, handlers.upload);
router.openapi(routes.getProgress, handlers.getProgress);

export default router;

