import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index.route";
import tasks from "@/routes/tasks/tasks.index";
import auth from "@/routes/auth/auth.index";
import apps from "@/routes/apps/apps.index";
import versions from "@/routes/versions/versions.index";
import updateTasks from "@/routes/update-tasks/update-tasks.index";
import appUsers from "@/routes/app-users/app-users.index";
import userGroups from "@/routes/user-groups/user-groups.index";
import logs from "@/routes/logs/logs.index";
import stats from "@/routes/stats/stats.index";
import platformUsers from "@/routes/platform-users/platform-users.index";
import upload from "@/routes/upload/upload.index";

const app = createApp();

configureOpenAPI(app);

const routes = [
  index,
  auth,
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
