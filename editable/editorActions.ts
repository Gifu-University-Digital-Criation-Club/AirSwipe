import type { GestureEvent } from "../src/types";

type PdfViewport = {
  width: number;
  height: number;
};

type PdfRenderTask = {
  promise: Promise<void>;
};

type PdfPage = {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
    transform: number[] | null;
  }): PdfRenderTask;
};

type PdfDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
};

type PdfJsModule = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument(source: {
    data: Uint8Array;
  }): {
    promise: Promise<PdfDocument>;
  };
};

export type PdfViewerController = {
  loadFile(file: File): Promise<void>;
};

const PDF_JS_MODULE_PATH = "/build/pdf.mjs";
const PDF_JS_WORKER_PATH = "/build/pdf.worker.mjs";
const presentationExtensions = new Set(["ppt", "pptx"]);

// PDF表示とジェスチャ操作を初期化し、外部からPDFを差し替える操作を提供します。
export function bindEditorActions(): PdfViewerController {
  const viewer = getRequiredElement<HTMLElement>("#pdf-viewer");
  const status = getRequiredElement<HTMLElement>("#pdf-status");

  viewer.style.width = "100%";
  viewer.style.padding = "0";

  let slides: HTMLElement[] = [];
  let currentIndex = 0;
  let isScrolling = false;
  let scrollEndTimer = 0;
  let scrollUpdateFrame = 0;
  let loadRequestId = 0;

  viewer.scrollTo({ left: 0, top: 0 });

  // 手動スクロール時も横方向の現在ページへ位置を追従させる
  viewer.addEventListener("scroll", scheduleCurrentIndexUpdate, { passive: true });

  // これは絶対に弄らない。一応解説：ジェスチャが確定すると main.ts から gesture-command が発火します。
  window.addEventListener("gesture-command", (event) => {
    renderGestureCommand((event as CustomEvent<GestureEvent>).detail);
  });

  void initializeInitialPdf();

  // 起動時は同梱のdemo.pdfを表示し、未配置ならPDFの選択を案内します。
  async function initializeInitialPdf(): Promise<void> {
    const initialRequestId = loadRequestId;

    try {
      const demoUrl = new URL("./demo.pdf", import.meta.url).href;
      const response = await fetch(demoUrl);
      if (initialRequestId !== loadRequestId) return;

      if (!response.ok) {
        showUnloadedState();
        return;
      }

      await loadPdfData(new Uint8Array(await response.arrayBuffer()), "demo.pdf");
    } catch (error) {
      if (initialRequestId !== loadRequestId) return;

      showUnloadedState();
      console.warn("demo.pdfを読み込めませんでした。", error);
    }
  }

  // 選択されたPDFまたはPowerPointを表示します。
  async function loadFile(file: File): Promise<void> {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension && presentationExtensions.has(extension)) {
      await loadPresentationFile(file);
      return;
    }

    await loadPdfData(new Uint8Array(await file.arrayBuffer()), file.name);
  }

  // PowerPointは開発サーバーでPDFへ変換してから、既存のPDF表示処理へ渡します。
  async function loadPresentationFile(file: File): Promise<void> {
    status.hidden = false;
    status.textContent = `PowerPointをPDFに変換しています… ${file.name}`;
    viewer.setAttribute("aria-busy", "true");

    try {
      const response = await fetch("/api/convert-presentation", {
        method: "POST",
        headers: { "X-Presentation-Filename": encodeURIComponent(file.name) },
        body: file,
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(result.message ?? "PowerPointをPDFへ変換できませんでした。");
      }

      const pdfFilename = `${file.name.replace(/\.(ppt|pptx)$/i, "")}.pdf`;
      await loadPdfData(new Uint8Array(await response.arrayBuffer()), pdfFilename);
    } catch (error) {
      viewer.setAttribute("aria-busy", "false");
      status.hidden = false;
      status.textContent = error instanceof Error ? error.message : "PowerPointをPDFへ変換できませんでした。";
    }
  }

  // PDF.jsを使い、PDFの全ページをcanvasへ描画します。
  async function loadPdfData(data: Uint8Array, filename: string): Promise<void> {
    const requestId = ++loadRequestId;
    viewer.setAttribute("aria-busy", "true");
    status.hidden = false;
    status.textContent = `PDFを読み込んでいます… ${filename}`;
    viewer.replaceChildren();
    slides = [];
    currentIndex = 0;
    viewer.scrollTo({ left: 0, top: 0 });

    try {
      const pdfjsLib = await loadPdfJs();
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdfDocument = await loadingTask.promise;

      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        if (requestId !== loadRequestId) return;

        status.textContent = `PDFを読み込んでいます… ${filename} (${pageNumber}/${pdfDocument.numPages})`;
        const slide = await createPdfSlide(pdfDocument, pageNumber);
        if (requestId !== loadRequestId) return;

        viewer.append(slide);
        slides.push(slide);
      }

      if (requestId !== loadRequestId) return;

      viewer.setAttribute("aria-busy", "false");
      status.hidden = true;
      syncCurrentIndex();
    } catch (error) {
      if (requestId !== loadRequestId) return;

      viewer.setAttribute("aria-busy", "false");
      status.hidden = false;
      status.textContent =
        error instanceof Error
          ? `PDFを表示できませんでした: ${error.message}`
          : "PDFを表示できませんでした。";
      console.error(error);
    }
  }

  // 起動時のdemo.pdfが存在しない場合に、PDF選択を促します。
  function showUnloadedState(): void {
    ++loadRequestId;
    viewer.replaceChildren();
    slides = [];
    currentIndex = 0;
    viewer.setAttribute("aria-busy", "false");
    status.hidden = false;
    status.textContent = "PDFは未読込です。「読込」からPDFを選択してください。";
  }

  // ジェスチャ確定時のページ位置を更新する関数です。
  function renderGestureCommand(event: GestureEvent): void {
    if (isScrolling || slides.length === 0) return;

    if (event.direction === "right" && currentIndex < slides.length - 1) {
      currentIndex++;
      scrollToSlide(currentIndex);
    } else if (event.direction === "left" && currentIndex > 0) {
      currentIndex--;
      scrollToSlide(currentIndex);
    }
  }

  // 指定したインデックスのページへスクロールする関数
  function scrollToSlide(index: number): void {
    const slide = slides[index];
    if (!slide) return;

    isScrolling = true;
    viewer.scrollTo({
      left: index * viewer.clientWidth,
      top: 0,
      behavior: "smooth",
    });

    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(() => {
      isScrolling = false;
      syncCurrentIndex();
    }, 600);
  }

  // スクロールイベントの連続発生を1画面描画につき1回にまとめる
  function scheduleCurrentIndexUpdate(): void {
    if (scrollUpdateFrame) return;

    scrollUpdateFrame = window.requestAnimationFrame(() => {
      scrollUpdateFrame = 0;
      syncCurrentIndex();
    });
  }

  // 横方向のスクロール位置から現在ページを記録する
  function syncCurrentIndex(): void {
    if (slides.length === 0 || viewer.clientWidth === 0) return;

    currentIndex = Math.min(
      slides.length - 1,
      Math.max(0, Math.round(viewer.scrollLeft / viewer.clientWidth)),
    );
  }

  return { loadFile };
}

// 必須のHTML要素を取得し、以降ではnullでない型として扱います。
function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`必要なHTML要素が見つかりません: ${selector}`);
  }
  return element;
}

// 配置済みのPDF.jsを読み込みます。
async function loadPdfJs(): Promise<PdfJsModule> {
  // import()を実行時に生成し、Viteのモジュール変換を通さずに
  // public/buildのPDF.jsをブラウザから直接読み込みます。
  const browserImport = new Function(
    "url",
    "return import(url)",
  ) as (url: string) => Promise<unknown>;

  const pdfjsLib = await browserImport(PDF_JS_MODULE_PATH) as PdfJsModule;

  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_PATH;
  return pdfjsLib;
}

// PDFの1ページをcanvasへ描画します。
async function createPdfSlide(
  pdfDocument: PdfDocument,
  pageNumber: number,
): Promise<HTMLElement> {
  const page = await pdfDocument.getPage(pageNumber);
  const originalViewport = page.getViewport({ scale: 1 });

  const screenWidth = Math.max(
    document.documentElement.clientWidth,
    1,
  );
  const screenHeight = Math.max(window.innerHeight, 1);
  const widthScale = screenWidth / originalViewport.width;
  const heightScale = screenHeight / originalViewport.height;
  const scale = Math.min(widthScale, heightScale);
  const viewport = page.getViewport({ scale });
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);

  const slide = document.createElement("section");
  slide.className = "slide-container pdf-page";
  slide.setAttribute("aria-label", `PDF ${pageNumber}ページ目`);
  slide.style.width = "100%";
  slide.style.height = "100vh";
  slide.style.margin = "0";
  slide.style.display = "flex";
  slide.style.alignItems = "center";
  slide.style.justifyContent = "center";
  slide.style.backgroundColor = "#000";
  slide.style.boxShadow = "none";

  const canvas = document.createElement("canvas");
  canvas.className = "pdf-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `PDF ${pageNumber}ページ目`);
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.objectFit = "contain";

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(`${pageNumber}ページ目のcanvasを作成できませんでした。`);
  }

  slide.append(canvas);

  const transform =
    outputScale === 1
      ? null
      : [outputScale, 0, 0, outputScale, 0, 0];

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform,
  }).promise;

  return slide;
}
