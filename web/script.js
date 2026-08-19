document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide-container');
    let currentIndex = 0;
    let isScrolling = false;

    // 初期状態で一番上のスライドを表示
    window.scrollTo(0, 0);

    window.addEventListener('keydown', (e) => {
        // 上下キーのみ処理対象とする
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault(); // デフォルトの標準スクロールを無効化

            // スクロールアニメーション中は連続入力を受け付けない
            if (isScrolling) return;

            if (e.key === 'ArrowDown') {
                // 下キー：次のスライドへ
                if (currentIndex < slides.length - 1) {
                    currentIndex++;
                    scrollToSlide(currentIndex);
                }
            } else if (e.key === 'ArrowUp') {
                // 上キー：前のスライドへ
                if (currentIndex > 0) {
                    currentIndex--;
                    scrollToSlide(currentIndex);
                }
            }
        }
    });

    // 指定したインデックスのスライドへスクロールする関数
    function scrollToSlide(index) {
        isScrolling = true;
        
        // 対象のスライドが画面の中央に来るようにスムーズスクロール
        slides[index].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        // スクロール完了を待つ（約600ms）ため、フラグの解除を遅延させる
        setTimeout(() => {
            isScrolling = false;
        }, 600);
    }
});