// Повторно загружаем только видео: текст, прокрутка и остальные блоки сохраняются.
/**
 * Битрикс: data-video-src на [data-text-video] получает URL видео из CMS.
 * Внутри обязательны player/error/loading/retry с соответствующими data-хуками.
 * При отсутствии источника не выводите весь видеоблок на сервере.
 * Повтор загружает только video, без перезагрузки текста и без автозапуска.
 * Адрес источника должен иметь разрешённый протокол; реальный файл передаёт CMS.
 */
export function initTextMedia() {
  document.querySelectorAll('[data-text-video]').forEach(block => {
    const player = block.querySelector('[data-video-player]');
    const error = block.querySelector('[data-video-error]');
    const loading = block.querySelector('[data-video-loading]');
    const retry = block.querySelector('[data-video-retry]');
    const finish = successful => {
      retry.disabled = false;
      loading.hidden = true;
      error.hidden = successful;
      player.hidden = !successful;
      block.setAttribute('aria-busy', 'false');
      (successful ? player : retry).focus();
    };
    player.addEventListener('loadeddata', () => finish(true));
    player.addEventListener('error', () => finish(false));
    retry.addEventListener('click', () => {
      // Источник передаётся из CMS. Без реального URL успешный результат не имитируем.
      if (!block.dataset.videoSrc) return;
      retry.disabled = true;
      error.hidden = true;
      loading.hidden = false;
      block.setAttribute('aria-busy', 'true');
      player.preload = 'auto';
      player.src = block.dataset.videoSrc;
      player.load();
    });
  });
}
