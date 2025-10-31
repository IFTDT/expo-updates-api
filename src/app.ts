import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import admin from "@/routes/admin/admin.index";
import appUsers from "@/routes/app-users/app-users.index";
import apps from "@/routes/apps/apps.index";
import auth from "@/routes/auth/auth.index";
import index from "@/routes/index.route";
import logs from "@/routes/logs/logs.index";
import platformUsers from "@/routes/platform-users/platform-users.index";
import stats from "@/routes/stats/stats.index";
import tasks from "@/routes/tasks/tasks.index";
import updateTasks from "@/routes/update-tasks/update-tasks.index";
import upload from "@/routes/upload/upload.index";
import userGroups from "@/routes/user-groups/user-groups.index";
import versions from "@/routes/versions/versions.index";

const app = createApp();

configureOpenAPI(app);

const routes = [
  index,
  auth,
  admin,
  apps,
  versions,
  updateTasks,
  appUsers,
  userGroups,
  logs,
  stats,
  platformUsers,
  upload,
  tasks,
] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
