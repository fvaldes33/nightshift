import { ip as ipAddress } from "address";
import chalk from "chalk";
import closeWithGrace from "close-with-grace";
import compression from "compression";
import { config } from "dotenv";
import express from "express";
import getPort, { portNumbers } from "get-port";
import morgan from "morgan";
import * as fs from "node:fs";
import sourceMapSupport from "source-map-support";

if (process.env.NODE_ENV === "development") {
  config({ path: "../../.env" });
}

sourceMapSupport.install({
  retrieveSourceMap: (source) => {
    const match = source.match(/^file:\/\/(.*)\?t=[.\d]+$/);
    if (match) {
      return {
        url: source,
        map: fs.readFileSync(`${match[1]}.map`, "utf8"),
      };
    }
    return null;
  },
});

closeWithGrace(async ({ err }) => {
  if (err) {
    console.error(chalk.red(err));
    console.error(chalk.red(err.stack));
    process.exit(1);
  }
});

const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";

const app = express();

app.use(compression({
  filter: (req) => {
    // Skip compression for streaming endpoints
    if (req.url.startsWith("/api/chat")) return false;
    return compression.filter(req, req.res);
  },
}));

const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
app.use((req, res, next) => {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.status(405).end();
    return;
  }
  next();
});

/** @type {{ shutdownQueue?: () => Promise<void> }} */
const lifecycle = {};

if (DEVELOPMENT) {
  console.log("Starting development server");
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  );
  app.use(viteDevServer.middlewares);
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule("./server/app.ts");
      return await source.app(req, res, next);
    } catch (error) {
      if (typeof error === "object" && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });
} else {
  console.log("Starting production server");
  app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
  app.use((req, res, next) => {
    try {
      decodeURIComponent(req.url);
    } catch {
      res.status(400).send("Bad Request");
      return;
    }
    next();
  });
  app.use(morgan("tiny"));
  app.use(express.static("build/client", { maxAge: "1h" }));
  const serverModule = await import(BUILD_PATH);
  app.use(serverModule.app);
  await serverModule.initQueue();
  lifecycle.shutdownQueue = serverModule.shutdownQueue;
  app.use((err, _req, res, _next) => {
    console.error("Unhandled request error:", err.message);
    res.status(500).send("Internal Server Error");
  });
}

const desiredPort = Number(process.env.PORT || 56677);
const portToUse = await getPort({
  port: portNumbers(desiredPort, desiredPort + 100),
});

const server = app.listen(portToUse, () => {
  const addy = server.address();
  const portUsed =
    desiredPort === portToUse ? desiredPort : addy && typeof addy === "object" ? addy.port : 0;

  if (portUsed !== desiredPort) {
    console.warn(chalk.yellow(`Port ${desiredPort} is not available, using ${portUsed} instead.`));
  }
  const localUrl = `http://localhost:${portUsed}`;
  let lanUrl = null;
  const localIp = ipAddress() ?? "Unknown";
  if (/^10[.]|^172[.](1[6-9]|2[0-9]|3[0-1])[.]|^192[.]168[.]/.test(localIp)) {
    lanUrl = `http://${localIp}:${portUsed}`;
  }

  console.log(
    `
${chalk.bold("Local:")}            ${chalk.cyan(localUrl)}
${lanUrl ? `${chalk.bold("On Your Network:")}  ${chalk.cyan(lanUrl)}` : ""}
${chalk.bold("Press Ctrl+C to stop")}
    `.trim(),
  );
});

closeWithGrace(async () => {
  if (lifecycle.shutdownQueue) {
    await lifecycle.shutdownQueue();
  }
  await new Promise((resolve, reject) => {
    server.close((e) => (e ? reject(e) : resolve("ok")));
  });
});
