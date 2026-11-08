/**
 * Разработчику Битрикс: это единственный вход Webpack. На сайте подключается
 * dist/assets/js/app.js; файлы из assets/js/raw отдельно не подключать.
 * Серверные методы задаются в window.DesisanIntegrations до подключения app.js:
 * загрузочные состояния могут вызвать их сразу на DOMContentLoaded.
 * Полный контракт и порядок переноса: docs/bitrix-guide.html.
 *
 * Инициализация рассчитана на первоначальный DOMContentLoaded. После AJAX-замены
 * HTML новые элементы сами не подключатся: нужна отдельная инициализация блока
 * с защитой от повторных слушателей либо обычная серверная навигация.
 * Нельзя повторно запускать весь app.js на прежнем DOM.
 */
import { initRails, initHero } from "./sliders.js";
import { initProductGallery, initProductReview } from "./product.js";
import { initCatalog } from "./catalog.js";
import { initCartPage } from "./cart.js";
import { initCheckout } from "./checkout.js";
import { initTextMedia } from "./text-media.js";
import { initContacts } from "./contacts.js";
import { initNews } from "./news.js";
import { initSearchResults } from "./search-results.js";
import { initOrderResult } from "./order-result.js";

// Общая логика интерфейса. Серверные операции вынесены в window.DesisanIntegrations:
// search(query, { signal }), addToCart(productId, { attemptId }), setCity(city).
// Методы возвращают Promise. URL и протокол Битрикс задаёт интегратор, не вёрстка.

document.addEventListener("DOMContentLoaded", () => {
  const dialogs = initDialogs();
  initHeader();
  initRails();
  initHero();
  initSearch(dialogs);
  initCity(dialogs);
  initCookieConsent();
  initCart();
  initCatalog(dialogs);
  initProductGallery();
  initProductReview();
  initCartPage();
  initCheckout();
  initTextMedia();
  initContacts();
  initNews();
  initSearchResults();
  initOrderResult();
  queueMicrotask(() => initPagePreview(dialogs));
});

// Изолированные страницы состояний для приёмки макета. Общие данные меню не меняются.
function initPagePreview(dialogs) {
  // Только демонстрация состояний. В боевом layout не выводить data-page-preview:
  // иначе можно принудительно показать тестовый toast или открыть окно при загрузке.
  const state = document.body.dataset.pagePreview;
  if (!state) return;
  const cookie = document.querySelector('[data-cookie-banner]');
  const city = document.querySelector('[data-city-notice]');
  cookie.hidden = state === 'cookies' ? false : true;
  city.hidden = state !== 'city-notice';
  if (state === 'menu' && innerWidth < 1280) dialogs.open('mobile-menu');
  if (state === 'city') dialogs.open('city-dialog');
  if (state === 'review') dialogs.open('product-review', document.querySelector('[data-open-dialog="product-review"]'));
  if (state === 'viewer') dialogs.open('product-viewer', document.querySelector('[data-open-dialog="product-viewer"]'));
  if (['search', 'suggestions', 'search-empty'].includes(state)) {
    dialogs.open('search-dialog');
    const input = document.querySelector('[data-search-input]');
    if (state !== 'search') {
      input.value = state === 'suggestions' ? 'сумка' : 'несуществующий товар';
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
  }
  if (state === 'empty-cart') document.querySelectorAll('[data-cart-count]').forEach(node => { node.hidden = true; });
  if (state === 'toast') {
    const toast = document.querySelector('[data-cart-toast]');
    toast.querySelector('[data-toast-message]').textContent = 'Сумка добавлена в корзину';
    toast.hidden = false;
  }
}

const desktopMedia = window.matchMedia("(min-width: 1280px)");

// Геометрия шапки нужна панелям поверх страницы: они не сдвигают основной контент.
function initHeader() {
  const header = document.querySelector("[data-header]");
  const main = document.querySelector("[data-header-main]");
  if (!header || !main) return;

  function update() {
    const bounds = main.getBoundingClientRect();
    document.documentElement.style.setProperty("--header-bottom", bounds.bottom + "px");
    header.classList.toggle("is-stuck", window.scrollY > (desktopMedia.matches ? 36 : 0));
    const city = header.querySelector(".header__city");
    if (city) document.documentElement.style.setProperty("--city-left", city.getBoundingClientRect().left + "px");
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  new ResizeObserver(update).observe(main);
  update();
}

// Нативный dialog удерживает фокус и исключает взаимодействие с фоном.
// История только у мобильного меню: системная кнопка «назад» закрывает его.
function initDialogs() {
  let menuHistoryActive = false;
  const menu = document.getElementById("mobile-menu");
  const all = [...document.querySelectorAll("dialog")];

  function updateState(dialog, opened) {
    document.querySelectorAll("[data-open-dialog]").forEach(button => {
      if (button.dataset.openDialog === dialog.id) button.setAttribute("aria-expanded", String(opened));
    });
    const anyOpen = all.some(item => item.open);
    if (anyOpen && !document.body.classList.contains("dialog-open")) {
      // Компенсация настоящей полосы прокрутки: контент не прыгает при открытии окна.
      document.body.style.paddingRight = (window.innerWidth - document.documentElement.clientWidth) + "px";
    }
    document.body.classList.toggle("dialog-open", anyOpen);
    if (!anyOpen) document.body.style.paddingRight = "";
  }

  function close(dialog) {
    if (dialog?.open) dialog.close();
  }

  function open(id, trigger) {
    const dialog = document.getElementById(id);
    if (!dialog || dialog.open) return;
    all.filter(item => item.open).forEach(close);
    dialog.returnFocus = trigger || document.activeElement;
    dialog.showModal();
    updateState(dialog, true);
    if (id === "mobile-menu") {
      history.pushState({ ...history.state, desisanMenu: true }, "", location.href);
      menuHistoryActive = true;
    }
    dialog.dispatchEvent(new Event("desisan:open"));
  }

  all.forEach(dialog => {
    dialog.addEventListener("close", () => {
      updateState(dialog, false);
      if (dialog.returnFocus?.isConnected) dialog.returnFocus.focus({ preventScroll: true });
      if (dialog === menu && menuHistoryActive) {
        menuHistoryActive = false;
        history.back();
      }
    });
    dialog.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => close(dialog)));
    // Поиск закрывается текстовой кнопкой или Esc. У выбора города работает и подложка.
    dialog.addEventListener("click", event => {
      if (dialog.id !== "city-dialog" || event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(dialog);
    });
  });
  document.querySelectorAll("[data-open-dialog]").forEach(button => {
    button.addEventListener("click", () => open(button.dataset.openDialog, button));
  });
  window.addEventListener("popstate", () => {
    menuHistoryActive = false;
    close(menu);
  });
  menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!menuHistoryActive) { close(menu); return; }
    // Сначала убираем запись открытого меню, затем переходим по ссылке.
    // Иначе асинхронный history.back из close отменяет начавшуюся навигацию.
    event.preventDefault();
    const url = link.href;
    menuHistoryActive = false;
    close(menu);
    window.addEventListener('popstate', () => window.location.assign(url), {once:true});
    history.back();
  }));
  desktopMedia.addEventListener("change", () => {
    if (desktopMedia.matches) close(menu);
  });
  return { open, close };
}

// Резервный поиск по демонстрационным карточкам; Битрикс подставляет свой метод.
// Нормализация поддерживает ё/е и распространённую транслитерацию.
function normalizeSearch(value) {
  const letters = { а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"e", ж:"zh", з:"z", и:"i", й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f", х:"h", ц:"ts", ч:"ch", ш:"sh", щ:"sch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya" };
  return value.toLocaleLowerCase("ru").replace(/[а-яё]/g, letter => letters[letter]).trim();
}

function initSearch(dialogs) {
  const panel = document.getElementById("search-dialog");
  const input = panel?.querySelector("[data-search-input]");
  if (!panel || !input) return;
  const form = panel.querySelector("[data-search-form]");
  const popular = panel.querySelector("[data-search-popular]");
  const output = panel.querySelector("[data-search-output]");
  const list = panel.querySelector("[data-search-results]");
  const empty = panel.querySelector("[data-search-empty]");
  const allLink = panel.querySelector("[data-search-all]");
  const status = panel.querySelector("[data-search-status]");
  const popularExists = !!popular.querySelector("li");
  let timer;
  let request;
  let requestVersion = 0;
  let selected = -1;
  const localProducts = [...document.querySelectorAll("[data-product-card]")].map(card => ({
    title: card.dataset.productTitle, url: card.dataset.productUrl,
    keywords: card.dataset.productKeywords || ""
  }));

  function highlight(anchor, title, query) {
    const index = title.toLocaleLowerCase("ru").indexOf(query.toLocaleLowerCase("ru"));
    if (index < 0) { anchor.textContent = title; return; }
    anchor.append(document.createTextNode(title.slice(0, index)));
    const mark = document.createElement("mark");
    mark.textContent = title.slice(index, index + query.length);
    anchor.append(mark, document.createTextNode(title.slice(index + query.length)));
  }
  function select(index) {
    const links = [...list.querySelectorAll("a")];
    selected = index;
    links.forEach((link, position) => link.classList.toggle("is-selected", position === index));
    if (links[index]) links[index].scrollIntoView({ block: "nearest" });
  }
  async function search() {
    const query = input.value.trim();
    const version = ++requestVersion;
    request?.abort();
    selected = -1;
    input.removeAttribute("aria-activedescendant");
    if (query.length < 2) {
      popular.hidden = !popularExists;
      output.hidden = true;
      list.replaceChildren();
      status.textContent = "";
      return;
    }
    request = new AbortController();
    try {
      let matches;
      if (typeof window.DesisanIntegrations?.search === "function") {
        // Ожидается массив { title, url }. Передайте signal в транспорт запроса.
        // Сервер проверяет наличие и возвращает безопасные URL своего каталога;
        // этот код отменяет устаревший ответ и оставляет не более пяти подсказок.
        matches = await window.DesisanIntegrations.search(query, { signal: request.signal });
      } else {
        const terms = normalizeSearch(query).split(/\s+/);
        matches = localProducts.filter(product => terms.every(term => normalizeSearch(product.title + " " + product.keywords).includes(term)));
      }
      if (version !== requestVersion) return;
      // Результаты контентного поиска — ссылки, без товарных фотографий.
      const seen = new Set();
      matches = matches.filter(item => {
        if (!item.title || !item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      }).slice(0, 5);
      list.replaceChildren();
      for (const item of matches) {
        const li = document.createElement("li");
        const anchor = document.createElement("a");
        anchor.href = item.url;
        highlight(anchor, item.title, query);
        li.append(anchor);
        list.append(li);
      }
      popular.hidden = matches.length > 0 || !popularExists;
      output.hidden = false;
      empty.hidden = matches.length > 0;
      const url = new URL(form.getAttribute("action"), location.href);
      url.searchParams.set("q", query);
      allLink.href = url.href;
      status.textContent = matches.length ? "Подсказок: " + matches.length : "Ничего не найдено";
    } catch (error) {
      if (error.name === "AbortError" || version !== requestVersion) return;
      // При сетевой ошибке обычная GET-форма остаётся доступна.
      popular.hidden = !popularExists;
      output.hidden = false;
      list.replaceChildren();
      empty.hidden = false;
      status.textContent = "Не удалось загрузить подсказки. Нажмите Enter для поиска.";
    }
  }
  input.addEventListener("input", () => {
    clearTimeout(timer);
    request?.abort();
    ++requestVersion;
    timer = setTimeout(search, 300);
  });
  input.addEventListener("keydown", event => {
    const links = [...list.querySelectorAll("a")];
    if (event.key === "Escape") {
      // У type=search браузер сначала очищает поле. Отменяем это действие:
      // по макету Esc закрывает панель и сохраняет запрос для следующего открытия.
      event.preventDefault();
      event.stopPropagation();
      dialogs.close(panel);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!links.length) return;
      event.preventDefault();
      select((selected + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length);
    } else if (event.key === "Enter" && links[selected]) {
      event.preventDefault();
      links[selected].click();
    }
  });
  form.addEventListener("submit", event => {
    if (!input.value.trim()) { event.preventDefault(); input.focus(); }
  });
  panel.querySelectorAll("[data-search-query]").forEach(button => button.addEventListener("click", () => {
    input.value = button.dataset.searchQuery;
    input.focus();
    clearTimeout(timer);
    search();
  }));
  panel.addEventListener("desisan:open", () => { input.focus(); search(); });
  panel.addEventListener("close", () => { clearTimeout(timer); request?.abort(); ++requestVersion; });
}

function readCookie(name) {
  const row = document.cookie.split("; ").find(value => value.startsWith(name + "="));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : "";
}
function saveCookie(name, value) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = name + "=" + encodeURIComponent(value) + "; Max-Age=31536000; Path=/; SameSite=Lax" + secure;
}

function initCookieConsent() {
  // Баннер сохраняет выбор, но сам не управляет аналитикой и рекламными скриптами.
  // Их подключение после согласия должен настроить интегратор отдельно.
  const banner = document.querySelector("[data-cookie-banner]");
  if (!banner) return;
  let sessionDismissed = false;
  try { sessionDismissed = sessionStorage.getItem("desisan-cookie-dismissed") === "1"; } catch {}
  banner.hidden = !!readCookie("desisan_consent") || sessionDismissed;
  function dismiss(accepted) {
    if (accepted) saveCookie("desisan_consent", "1");
    else { try { sessionStorage.setItem("desisan-cookie-dismissed", "1"); } catch {} }
    banner.hidden = true;
    document.dispatchEvent(new Event("desisan:consent-dismissed"));
  }
  banner.querySelector("[data-cookie-accept]").addEventListener("click", () => dismiss(true));
  banner.querySelector("[data-cookie-close]").addEventListener("click", () => dismiss(false));
}

function initCity(dialogs) {
  const panel = document.getElementById("city-dialog");
  const notice = document.querySelector("[data-city-notice]");
  if (!panel || !notice) return;
  const input = panel.querySelector("[data-city-search]");
  const choices = [...panel.querySelectorAll("[data-city-choice]")];
  let current = readCookie("desisan_city") || document.querySelector("[data-current-city]")?.textContent || "Орёл";
  let detected = notice.dataset.detectedCity;

  function renderCity(city) {
    current = city;
    document.querySelectorAll("[data-current-city]").forEach(item => item.textContent = city);
    choices.forEach(button => {
      const selected = button.dataset.cityChoice === city;
      button.setAttribute("aria-pressed", String(selected));
      button.querySelector("img").hidden = !selected;
    });
  }
  function maybeShowNotice() {
    const cookieVisible = !document.querySelector("[data-cookie-banner]")?.hidden;
    // IP-определение выполняется сервером. Без результата показывать выдуманный город нельзя.
    notice.hidden = !detected || !!readCookie("desisan_city_confirmed") || cookieVisible || !!document.querySelector("dialog[open]");
    if (!notice.hidden) renderCity(detected);
  }
  async function choose(city) {
    try {
      if (typeof window.DesisanIntegrations?.setCity === "function") await window.DesisanIntegrations.setCity(city);
      renderCity(city);
      saveCookie("desisan_city", city);
      saveCookie("desisan_city_confirmed", "1");
      notice.hidden = true;
      dialogs.close(panel);
      // Интегратор обновляет расчёт доставки после подтверждённой смены города.
      document.dispatchEvent(new CustomEvent("desisan:city-changed", { detail: { city } }));
    } catch {
      panel.querySelector("[data-city-empty]").hidden = false;
      panel.querySelector("[data-city-empty]").textContent = "Не удалось изменить город. Попробуйте ещё раз.";
    }
  }
  choices.forEach(button => button.addEventListener("click", () => choose(button.dataset.cityChoice)));
  input.addEventListener("input", () => {
    const query = input.value.trim().toLocaleLowerCase("ru");
    choices.forEach(button => button.closest("li").hidden = !button.dataset.cityChoice.toLocaleLowerCase("ru").includes(query));
    panel.querySelector("[data-city-empty]").textContent = "Город не найден. Попробуйте другое название.";
    panel.querySelector("[data-city-empty]").hidden = choices.some(button => !button.closest("li").hidden);
  });
  notice.querySelector("[data-city-confirm]").addEventListener("click", () => choose(current));
  notice.querySelector("[data-city-dismiss]").addEventListener("click", () => {
    saveCookie("desisan_city_confirmed", "1");
    notice.hidden = true;
  });
  panel.addEventListener("desisan:open", () => {
    notice.hidden = true;
    input.value = "";
    input.dispatchEvent(new Event("input"));
  });
  document.addEventListener("desisan:consent-dismissed", maybeShowNotice);
  document.addEventListener("desisan:geo-detected", event => { detected = event.detail?.city || ""; maybeShowNotice(); });
  renderCity(current);
  // Согласие проверяется в следующей задаче, после инициализации cookie-плашки.
  queueMicrotask(maybeShowNotice);
}

function initCart() {
  const toast = document.querySelector("[data-cart-toast]");
  const errorMessage = document.querySelector("[data-cart-error]");
  if (!toast) return;
  let timeout;
  let remaining = 5000;
  let startedAt = 0;
  function hideToast() { clearTimeout(timeout); toast.hidden = true; }
  function schedule() {
    clearTimeout(timeout);
    startedAt = Date.now();
    timeout = setTimeout(hideToast, remaining);
  }
  toast.addEventListener("mouseenter", () => {
    clearTimeout(timeout);
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
  });
  toast.addEventListener("mouseleave", schedule);
  toast.querySelector("[data-toast-close]").addEventListener("click", hideToast);

  document.querySelectorAll("[data-add-to-cart]").forEach(button => {
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      const purchase = button.closest(".product-info__purchase");
      const label = button.querySelector("[data-purchase-label]");
      const loading = button.querySelector(".product-info__loading");
      const productError = purchase?.querySelector("[data-product-error]");
      if (label) label.hidden = true;
      if (loading) loading.hidden = false;
      if (productError) productError.hidden = true;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      errorMessage.textContent = "";
      try {
        if (typeof window.DesisanIntegrations?.addToCart !== "function") {
          // Без Битрикс не показываем фиктивное подтверждение и не меняем счётчик.
          throw new Error("Cart integration is not configured");
        }
        // Повтор после сетевой ошибки использует тот же ключ: сервер исключает дубли.
        button.dataset.cartAttempt ||= crypto.randomUUID();
        const response = await window.DesisanIntegrations.addToCart(button.dataset.addToCart, {attemptId:button.dataset.cartAttempt});
        // count — полное количество единиц во всей корзине, не прирост и не число строк.
        // data-add-to-cart должен содержать реальный ID товара/торгового предложения.
        // При сетевом повторе сервер узнаёт тот же attemptId и не добавляет товар дважды.
        if (purchase && response?.status === 'price-changed') {
          delete button.dataset.cartAttempt;
          if (Number.isFinite(response.price)) purchase.querySelector('.product-info__price > span').textContent = new Intl.NumberFormat('ru-RU').format(response.price) + '\u00a0₽';
          productError.textContent = 'Цена обновилась. Проверьте её перед добавлением.';
          productError.hidden = false;
          return;
        }
        if (purchase && response?.status === 'unavailable') {
          delete button.dataset.cartAttempt;
          label.textContent = 'Нет в наличии';
          button.dataset.productUnavailable = 'true';
          productError.textContent = 'Нет в наличии';
          productError.hidden = false;
          return;
        }
        if (!response || !Number.isFinite(response.count)) throw new Error("Invalid cart response");
        delete button.dataset.cartAttempt;
        document.querySelectorAll("[data-cart-count]").forEach(counter => {
          counter.textContent = response.count;
          counter.hidden = response.count <= 0;
        });
        const productTitle = response.title || button.dataset.productTitle || button.closest("[data-product-card]")?.dataset.productTitle || "Товар";
        toast.querySelector("[data-toast-message]").textContent = productTitle + (productTitle === "Товар" ? " добавлен в корзину" : " добавлена в корзину");
        toast.hidden = false;
        if (purchase) {
          button.hidden = true;
          purchase.querySelector("[data-product-in-cart]").hidden = false;
        }
        remaining = 5000;
        schedule();
      } catch {
        errorMessage.textContent = "Не удалось добавить товар в корзину. Попробуйте позже.";
        if (productError) {
          productError.textContent = "Не удалось добавить товар. Попробуйте ещё раз.";
          productError.hidden = false;
          label.textContent = "Повторить";
        }
      } finally {
        button.disabled = button.dataset.productUnavailable === 'true';
        button.removeAttribute("aria-busy");
        if (label) label.hidden = false;
        if (loading) loading.hidden = true;
      }
    });
  });
}
