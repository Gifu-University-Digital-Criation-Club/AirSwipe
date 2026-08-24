import { readFileSync } from "node:fs";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { defineConfig } from "vite";

const editableHtmlRoute = "/editable/main.html";
const editableHtmlPath = resolve(process.cwd(), "editable/main.html");
const presentationConversionRoute = "/api/convert-presentation";
const supportedPresentationExtensions = new Set([".ppt", ".pptx"]);

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

function presentationConversionDevPlugin() {
  return {
    name: "presentation-conversion-dev",
    apply: "serve",

    configureServer(server) {
      server.middlewares.use(presentationConversionRoute, (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        void convertPresentationRequest(request, response).catch(next);
      });
    },
  };
}

async function convertPresentationRequest(request, response) {
  const filenameHeader = request.headers["x-presentation-filename"];
  const filename = Array.isArray(filenameHeader) ? filenameHeader[0] : filenameHeader;
  const inputFilename = basename(decodeURIComponent(filename ?? "presentation.pptx"));
  const extension = extname(inputFilename).toLowerCase();

  if (!supportedPresentationExtensions.has(extension)) {
    sendConversionError(response, 400, "PowerPoint（.ppt / .pptx）を指定してください。");
    return;
  }

  try {
    const input = await readRequestBody(request);
    const tempDirectory = await mkdtemp(join(tmpdir(), "airswipe-presentation-"));

    try {
      await writeFile(join(tempDirectory, inputFilename), input);
      await convertWithLibreOffice(tempDirectory, inputFilename);

      const pdfFilename = (await readdir(tempDirectory)).find((file) => extname(file).toLowerCase() === ".pdf");
      if (!pdfFilename) throw new Error("PDFファイルを生成できませんでした。");

      const pdf = await readFile(join(tempDirectory, pdfFilename));
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", `inline; filename="${basename(inputFilename, extension)}.pdf"`);
      response.end(pdf);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "PowerPointをPDFへ変換できませんでした。";
    sendConversionError(response, 500, message);
  }
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    const maxSize = 100 * 1024 * 1024;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        rejectBody(new Error("PowerPointファイルは100MB以下にしてください。"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolveBody(Buffer.concat(chunks)));
    request.on("error", rejectBody);
  });
}

async function convertWithLibreOffice(directory, filename) {
  const command = await findLibreOfficeCommand();
  const result = await runCommand(command, ["--headless", "--convert-to", "pdf", "--outdir", directory, join(directory, filename)]);

  if (result.exitCode !== 0) {
    throw new Error(`PowerPointをPDFへ変換できませんでした。${result.output}`);
  }
}

async function findLibreOfficeCommand() {
  const candidates = [
    process.env.AIRSWIPE_SOFFICE_PATH,
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "soffice",
    "libreoffice",
  ].filter(Boolean);

  for (const command of candidates) {
    if (command.includes("/")) {
      try {
        await access(command);
        return command;
      } catch {
        // 次の候補を試す。
      }
    } else {
      const result = await runCommand(command, ["--version"]).catch(() => null);
      if (result?.exitCode === 0) return command;
    }
  }

  throw new Error(
    "PowerPointの変換にはLibreOfficeが必要です。LibreOfficeをインストール後、pnpm run devを再起動してください。",
  );
}

function runCommand(command, args) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { windowsHide: true });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", () => rejectCommand(new Error("LibreOfficeを起動できませんでした。インストールを確認してください。")));
    child.on("close", (exitCode) => resolveCommand({ exitCode, output }));
  });
}

function sendConversionError(response, statusCode, message) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ message }));
}

export default defineConfig({
  plugins: [editableHtmlDevPlugin(), editableHtmlBuildPlugin(), presentationConversionDevPlugin()],
  server: {
    watch: {
      ignored: ["**/public/mediapipe/models/*.task"],
    },
  },
});
