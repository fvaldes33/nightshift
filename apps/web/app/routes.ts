import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),

  layout("routes/app-layout.tsx", [
    index("routes/dashboard.tsx"),
    route("sessions/new", "routes/sessions/new.tsx"),
    route("sessions/:sessionId", "routes/sessions/session.tsx"),
    route("repos", "routes/repos/index.tsx"),
    route("repos/:repoId", "routes/repos/repo.tsx"),
    route("repos/:repoId/docs", "routes/repos/docs.tsx"),
    route("docs", "routes/docs/index.tsx"),
    route("docs/:docId", "routes/docs/doc.tsx"),
    route("tasks", "routes/tasks/index.tsx"),
    route("tasks/:taskId", "routes/tasks/task.tsx"),
    route("loops", "routes/loops/index.tsx"),
    route("loops/:loopId", "routes/loops/loop.tsx"),
  ]),
] satisfies RouteConfig;
