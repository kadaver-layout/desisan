// Карточки заранее собраны Nunjucks; JS управляет только ожиданием и догрузкой.
export function initNews() {
  document.querySelectorAll('[data-news-image]').forEach(image => {
    image.addEventListener('error', () => {
      image.style.visibility = 'hidden';
      image.parentElement.style.backgroundColor = 'var(--news-image-fallback, #f2f1ef)';
    });
  });
  const page = document.querySelector('[data-news-page]');
  const articleRetry = document.querySelector('[data-news-article-retry]');
  articleRetry?.addEventListener('click', async () => {
    articleRetry.disabled = true;
    articleRetry.setAttribute('aria-busy', 'true');
    try {
      await window.DesisanIntegrations?.beforeNewsArticleLoad?.();
      window.location.assign('news-article-1.html');
    } catch {
      articleRetry.disabled = false;
      articleRetry.setAttribute('aria-busy', 'false');
    }
  });
  if (!page) return;
  const grid = page.querySelector('[data-news-grid]');
  const cards = [...grid.querySelectorAll('[data-news-item]')];
  const skeletons = [...grid.querySelectorAll('[data-news-skeleton]')];
  const moreWrapper = page.querySelector('[data-news-more-wrapper]');
  const more = page.querySelector('[data-news-more]');
  const error = page.querySelector('[data-news-error]');
  const moreError = page.querySelector('[data-news-more-error]');
  const label = more.querySelector('[data-news-more-label]');
  const spinner = more.querySelector('[data-news-more-spinner]');
  let busy = false;
  let shown = cards.filter(card => !card.hidden).length;

  function render() {
    cards.forEach((card, index) => { card.hidden = index >= shown; });
    moreWrapper.hidden = shown >= cards.length;
  }
  const shownParameter = Number(new URL(window.location.href).searchParams.get('shown'));
  if (!page.dataset.newsState && shownParameter > shown) {
    shown = Math.min(cards.length, shownParameter);
    render();
  }

  async function load(initial) {
    if (busy) return;
    busy = true;
    const offset = initial ? 0 : shown;
    more.disabled = true;
    more.setAttribute('aria-busy', 'true');
    label.hidden = true;
    spinner.hidden = false;
    error.hidden = true;
    moreError.hidden = true;
    grid.hidden = false;
    grid.setAttribute('aria-busy', 'true');
    skeletons.forEach(node => { node.hidden = false; });
    try {
      const adapter = window.DesisanIntegrations?.beforeNewsLoad;
      // Пауза демонстрирует предусмотренное макетом ожидание локальной порции.
      if (adapter) await adapter({ offset, limit: 6 });
      else await new Promise(resolve => setTimeout(resolve, 300));
      shown = Math.min(cards.length, offset + 6);
      render();
      label.textContent = 'Показать ещё';
      const url = new URL(window.location.href);
      url.searchParams.set('shown', shown);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      if (initial) { error.hidden = false; grid.hidden = true; }
      else { moreError.hidden = false; label.textContent = 'Попробовать снова'; }
    } finally {
      skeletons.forEach(node => { node.hidden = true; });
      grid.setAttribute('aria-busy', 'false');
      more.disabled = false;
      more.setAttribute('aria-busy', 'false');
      label.hidden = false;
      spinner.hidden = true;
      busy = false;
    }
  }
  more.addEventListener('click', () => load(false));
  page.querySelector('[data-news-retry]').addEventListener('click', () => load(true));
  if (page.dataset.newsState === 'loading') load(true);
  if (page.dataset.newsState === 'loading-more') load(false);
}
