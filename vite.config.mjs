import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const editableHtmlRoute = "/editable/main.html";
const editableHtmlPath = resolve(process.cwd(), "editable/main.html");

function editableHtmlDevPlugin() {
  return {
    name: "editable-html-dev",
    apply: "serve",

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        if (pathname !== editableHtmlRoute) {
          next();
          return;
        }

        try {
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(readFileSync(editableHtmlPath, "utf8"));
        } catch (error) {
          next(error);
        }
      });

      server.watcher.add(editableHtmlPath);
      server.watcher.on("change", (path) => {
        if (resolve(path) === editableHtmlPath) {
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

function editableHtmlBuildPlugin() {
  return {
    name: "editable-html-build",
    apply: "build",

    buildStart() {
      this.emitFile({
        type: "asset",
        fileName: "editable/main.html",
        source: readFileSync(editableHtmlPath, "utf8"),
      });
    },
  };
}

export default defineConfig({
  plugins: [editableHtmlDevPlugin(), editableHtmlBuildPlugin()],
  server: {
    watch: {
      ignored: ["**/public/mediapipe/models/*.task"],
    },
  },
});
