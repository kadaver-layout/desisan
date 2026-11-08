// Выдача и следующая порция уже находятся в HTML. Адаптер подключает проверку Битрикс.
/**
 * Битрикс: q берётся из адреса, затем локально фильтруются готовые HTML-карточки.
 * Это не полнотекстовый поиск по всему каталогу. Реальную выдачу, наличие,
 * склонения/транслитерацию и общее число результатов рассчитывает сервер.
 * beforeSearchResultsLoad({ query, offset, limit: 24 }) — Promise ожидания;
 * возвращаемый ответ не вставляется, items/matches — снимки первоначального DOM.
 * Для AJAX-пагинации требуется отдельная замена этой демонстрационной ветки.
 * data-search-state — только страницы примеров состояний.
 */
export function initSearchResults() {
  const root = document.querySelector('[data-search-results-page]');
  if (!root) return;
  const grid = root.querySelector('[data-results-grid]');
  const items = [...grid.querySelectorAll('[data-result-item]')];
  const skeletons = [...grid.querySelectorAll('[data-results-skeleton]')];
  const more = root.querySelector('[data-results-more]');
  const wrapper = root.querySelector('[data-results-more-wrapper]');
  const progress = root.querySelector('[data-results-progress]');
  const count = root.querySelector('[data-results-count]');
  const empty = root.querySelector('[data-results-empty]');
  const error = root.querySelector('[data-results-error]');
  const moreError = root.querySelector('[data-results-more-error]');
  const retry = root.querySelector('[data-results-retry]');
  const params = new URL(location.href).searchParams;
  const query = params.get('q')?.trim() || root.dataset.searchQuery;
  root.querySelector('[data-results-query]').textContent = query;
  document.title = `Результаты поиска: «${query}» — DESISAN`;
  const normalize = value => value.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[\s−-]+/g, ' ').trim();
  let matches = items;
  if (params.has('q')) {
    const words = normalize(query).split(' ');
    matches = items.filter(item => words.every(word => normalize(item.querySelector('[data-product-card]').dataset.productKeywords).includes(word)));
  }
  if (root.dataset.searchState === 'one') matches = items.filter((_, index) => index === 1);
  let shown = root.dataset.searchState === 'end' ? matches.length : Math.min(matches.length, Math.max(24, Number(params.get('shown')) || 24));
  let busy = false;

  function productWord(total) {
    const last = total % 10;
    if (total % 100 >= 11 && total % 100 <= 14) return 'товаров';
    return last === 1 ? 'товар' : last >= 2 && last <= 4 ? 'товара' : 'товаров';
  }
  function render() {
    items.forEach(item => { item.hidden = !matches.slice(0, shown).includes(item); });
    const total = matches.length;
    count.textContent = `${total} ${productWord(total)}`;
    empty.hidden = total > 0;
    grid.hidden = !total;
    wrapper.hidden = total <= 24;
    more.hidden = shown >= total;
    progress.textContent = shown >= total ? `Все ${total} ${productWord(total)} показаны` : `Показано ${shown} из ${total} товаров`;
    const url = new URL(location.href);
    if (shown > 24) url.searchParams.set('shown', shown);
    else url.searchParams.delete('shown');
    history.replaceState(history.state, '', url);
  }
  if (params.has('q') || ['results','initial','end','one'].includes(root.dataset.searchState)) render();

  async function load(initial) {
    if (busy) return;
    busy = true;
    const offset = initial ? 0 : shown;
    more.disabled = true;
    retry.disabled = true;
    more.setAttribute('aria-busy', 'true');
    retry.setAttribute('aria-busy', 'true');
    more.querySelector('[data-results-more-label]').hidden = true;
    more.querySelector('[data-results-spinner]').hidden = false;
    error.hidden = true;
    moreError.hidden = true;
    grid.hidden = false;
    grid.setAttribute('aria-busy', 'true');
    skeletons.forEach(item => { item.hidden = false; });
    if (initial) count.textContent = 'Ищем товары…';
    try {
      const adapter = window.DesisanIntegrations?.beforeSearchResultsLoad;
      if (adapter) await adapter({ query, offset, limit: 24 });
      else await new Promise(resolve => setTimeout(resolve, 300));
      shown = Math.min(matches.length, offset + 24);
      render();
      more.querySelector('[data-results-more-label]').textContent = 'Показать ещё';
    } catch {
      if (initial) {
        grid.hidden = true;
        error.hidden = false;
        count.textContent = 'Результаты поиска не получены';
      } else {
        moreError.hidden = false;
        more.querySelector('[data-results-more-label]').textContent = 'Повторить';
      }
    } finally {
      skeletons.forEach(item => { item.hidden = true; });
      grid.setAttribute('aria-busy', 'false');
      more.disabled = false;
      retry.disabled = false;
      more.setAttribute('aria-busy', 'false');
      retry.setAttribute('aria-busy', 'false');
      more.querySelector('[data-results-more-label]').hidden = false;
      more.querySelector('[data-results-spinner]').hidden = true;
      busy = false;
    }
  }
  more.addEventListener('click', () => load(false));
  retry.addEventListener('click', () => load(true));
  if (root.dataset.searchState === 'loading') load(true);
  if (root.dataset.searchState === 'loading-more') load(false);
}
