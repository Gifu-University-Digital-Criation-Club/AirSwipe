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
    url: string;
  }): {
    promise: Promise<PdfDocument>;
  };
};

const PDF_JS_MODULE_PATH = "/build/pdf.mjs";
const PDF_JS_WORKER_PATH = "/build/pdf.worker.mjs";
const MAX_PAGE_WIDTH = 960;

// イベント受け取り用関数です。
export function bindEditorActions(): void {
  const viewer = getRequiredElement<HTMLElement>("#pdf-viewer");
  const status = getRequiredElement<HTMLElement>("#pdf-status");

  let slides: HTMLElement[] = [];
  let currentIndex = 0;
  let isScrolling = false;
  let scrollEndTimer = 0;
  let scrollUpdateFrame = 0;

  window.scrollTo(0, 0);

  // 手動スクロール時も画面中央に最も近いページへ現在位置を追従させる
  window.addEventListener("scroll", scheduleCurrentIndexUpdate, { passive: true });

  // これは絶対に弄らない。一応解説：ジェスチャが確定すると main.ts から gesture-command が発火します。
  window.addEventListener("gesture-command", (event) => {
    renderGestureCommand((event as CustomEvent<GestureEvent>).detail);
  });

  void initializePdf();

  // PDF.jsを読み込み、PDFの全ページをcanvasへ描画します。
  async function initializePdf(): Promise<void> {
    try {
      const pdfjsLib = await loadPdfJs();
      const pdfUrl = new URL("./demo.pdf", import.meta.url).href;
      const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
      const pdfDocument = await loadingTask.promise;

      viewer.replaceChildren();
      slides = [];

      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        status.textContent = `PDFを読み込んでいます… ${pageNumber}/${pdfDocument.numPages}`;

        const slide = await createPdfSlide(pdfDocument, pageNumber);
        viewer.append(slide);
        slides.push(slide);
      }

      viewer.setAttribute("aria-busy", "false");
      status.hidden = true;
      currentIndex = 0;
      syncCurrentIndex();
    } catch (error) {
      viewer.setAttribute("aria-busy", "false");
      status.hidden = false;
      status.textContent =
        error instanceof Error
          ? `PDFを表示できませんでした: ${error.message}`
          : "PDFを表示できませんでした。";

      console.error(error);
    }
  }

  // ジェスチャ確定時のページ位置を更新する関数です。
  function renderGestureCommand(event: GestureEvent): void {
    if (isScrolling || slides.length === 0) return;

    if (event.direction === "down" && currentIndex < slides.length - 1) {
      currentIndex++;
      scrollToSlide(currentIndex);
    } else if (event.direction === "up" && currentIndex > 0) {
      currentIndex--;
      scrollToSlide(currentIndex);
    }
  }

  // 指定したインデックスのページへスクロールする関数
  function scrollToSlide(index: number): void {
    const slide = slides[index];
    if (!slide) return;

    isScrolling = true;
    slide.scrollIntoView({
      behavior: "smooth",
      block: "center",
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

  // 画面中央に最も近いページを現在位置として記録する
  function syncCurrentIndex(): void {
    if (slides.length === 0) return;

    const viewportCenter = window.innerHeight / 2;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.top + rect.height / 2;
      const distance = Math.abs(slideCenter - viewportCenter);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    currentIndex = nearestIndex;
  }
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
  const availableWidth = Math.min(
    MAX_PAGE_WIDTH,
    Math.max(window.innerWidth - 32, 1),
  );
  const scale = availableWidth / originalViewport.width;
  const viewport = page.getViewport({ scale });
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);

  const slide = document.createElement("section");
  slide.className = "slide-container pdf-page";
  slide.setAttribute("aria-label", `PDF ${pageNumber}ページ目`);
  slide.style.width = `${viewport.width}px`;
  slide.style.height = `${viewport.height}px`;

  const canvas = document.createElement("canvas");
  canvas.className = "pdf-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `PDF ${pageNumber}ページ目`);
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.display = "block";
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

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
