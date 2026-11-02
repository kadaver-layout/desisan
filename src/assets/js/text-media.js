// Повторно загружаем только видео: текст, прокрутка и остальные блоки сохраняются.
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
