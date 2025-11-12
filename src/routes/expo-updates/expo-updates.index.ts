import { createRouter } from "@/lib/create-app";

import { assetsHandler, manifestHandler } from "./expo-updates.handlers";
import { assetsRoute, manifestRoute } from "./expo-updates.routes";

const router = createRouter();

router.openapi(manifestRoute, manifestHandler);
router.openapi(assetsRoute, assetsHandler);

export default router;
