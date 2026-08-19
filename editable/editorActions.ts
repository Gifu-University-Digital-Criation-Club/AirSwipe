import type { GestureEvent } from "../src/types";

// イベント受け取り用関数です。
export function bindEditorActions(): void {
  const slides = Array.from(document.querySelectorAll<HTMLElement>(".slide-container"));
  let currentIndex = 0;
  let isScrolling = false;
  let scrollEndTimer = 0;
  let scrollUpdateFrame = 0;

  // 初期状態で一番上のスライドを表示
  window.scrollTo(0, 0);
  syncCurrentIndex();

  // 手動スクロール時も画面中央に最も近いスライドへ現在位置を追従させる
  window.addEventListener("scroll", scheduleCurrentIndexUpdate, { passive: true });

  // これは絶対に弄らない。一応解説：ジェスチャが確定すると main.ts から gesture-command が発火します。
  window.addEventListener("gesture-command", (event) => {
    renderGestureCommand((event as CustomEvent<GestureEvent>).detail);
  });

  // ジェスチャ確定時のスライド位置を更新する関数です。
  function renderGestureCommand(event: GestureEvent): void {
    // ■■■■■■■■■■■■■■■■【編集ここから】■■■■■■■■■■■■■■■■
    //
    // スクロールアニメーション中は連続入力を受け付けない
    if (isScrolling) return;

    // 服部君への私信：もともとスクロール処理が書かれていた部分は現行の仕様に合うように書き直しました。読んだら消してください
    if (event.direction === "down" && currentIndex < slides.length - 1) {
      currentIndex++;
      scrollToSlide(currentIndex);
    } else if (event.direction === "up" && currentIndex > 0) {
      currentIndex--;
      scrollToSlide(currentIndex);
    }

    // left、rightなどの独自動作を追加する場合は、ここへ記入します。
    // 記入例（左方向で、現在のスライドを少し動かす）:
    // if (event.direction === "left") {
    //   slides[currentIndex]?.animate(
    //     [
    //       { transform: "translateX(0)" },
    //       { transform: "translateX(-24px)" },
    //       { transform: "translateX(0)" },
    //     ],
    //     { duration: 240 },
    //   );
    // }


    // ■■■■■■■■■■■■■■■■【ここまで】■■■■■■■■■■■■■■■■
  }

  // 指定したインデックスのスライドへスクロールする関数
  function scrollToSlide(index: number): void {
    const slide = slides[index];
    if (!slide) return;

    isScrolling = true;

    // 対象のスライドが画面の中央に来るようにスムーズスクロール
    slide.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // スクロール完了を待つ（約600ms）ため、フラグの解除を遅延させる
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

  // 画面中央に最も近いスライドを現在位置として記録する
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
