// Каталог работает с HTML-карточками, собранными Nunjucks.
// Битрикс может передать реальные данные в тот же шаблон; DOM не создаётся из JS-JSON.
export function initCatalog(dialogs) {
  const root = document.querySelector("[data-catalog]");
  if (!root) return;
  const pageSize = Number(root.dataset.pageSize) || 24;
  const grid = root.querySelector("[data-catalog-grid]");
  const items = [...grid.querySelectorAll("[data-catalog-item]")].map(element => ({
    element, price: Number(element.dataset.price), oldPrice: Number(element.dataset.oldPrice),
    gender: element.dataset.gender, type: element.dataset.type,
    isNew: element.dataset.new === "true", order: Number(element.dataset.order)
  }));
  const desktop = window.matchMedia("(min-width: 1280px)");
  const filtersDialog = document.getElementById("catalog-filters");
  const sortDialog = document.getElementById("catalog-sort-dialog");
  const more = root.querySelector("[data-catalog-more]");
  const moreButton = root.querySelector("[data-load-more]");
  const loadError = root.querySelector("[data-load-error]");
  const allPopovers = [...root.querySelectorAll(".catalog-popover, .catalog-sort__list")];
  let state = readAddress();
  let draft = clone(state);
  let busy = false;
  let version = 0;

  function defaults() {
    return { min: "", max: "", discount: false, gender: [], type: [], sort: "popular", shown: pageSize };
  }
  function clone(value) {
    return { ...value, gender: [...value.gender], type: [...value.type] };
  }
  function readAddress() {
    const params = new URLSearchParams(location.search);
    const value = defaults();
    for (const key of ["min", "max"]) {
      const number = Number(params.get(key));
      if (params.has(key) && Number.isFinite(number) && number >= 0) value[key] = String(number);
    }
    value.discount = params.get("discount") === "1";
    for (const key of ["gender", "type"]) {
      const allowed = [...root.querySelectorAll('[data-filter-option="' + key + '"]')].map(input => input.value);
      value[key] = (params.get(key) || "").split(",").filter(item => allowed.includes(item));
    }
    const sort = params.get("sort") || "popular";
    if ([...root.querySelectorAll('[data-sort]')].some(button => button.dataset.sort === sort)) value.sort = sort;
    value.shown = Math.max(pageSize, Math.min(items.length || pageSize, Number(params.get("shown")) || pageSize));
    return value;
  }
  function updateAddress(replace = false) {
    const url = new URL(location.href);
    for (const key of ["min", "max", "discount", "gender", "type", "sort", "shown"]) {
      url.searchParams.delete(key);
    }
    for (const key of ["min", "max"]) if (state[key] !== "") url.searchParams.set(key, state[key]);
    if (state.discount) url.searchParams.set("discount", "1");
    for (const key of ["gender", "type"]) if (state[key].length) url.searchParams.set(key, state[key].join(","));
    if (state.sort !== "popular") url.searchParams.set("sort", state.sort);
    if (state.shown > pageSize) url.searchParams.set("shown", String(state.shown));
    if (url.href !== location.href) history[replace ? "replaceState" : "pushState"]({ ...history.state }, "", url);
  }
  function matches(item, value, ignoredGroup = "") {
    return (ignoredGroup === "price" || ((value.min === "" || item.price >= Number(value.min)) && (value.max === "" || item.price <= Number(value.max))))
      && (ignoredGroup === "discount" || !value.discount || item.oldPrice > item.price)
      && (ignoredGroup === "gender" || !value.gender.length || value.gender.includes(item.gender))
      && (ignoredGroup === "type" || !value.type.length || value.type.includes(item.type));
  }
  function filtered(value = state) {
    const result = items.filter(item => matches(item, value));
    return result.sort((a, b) => {
      if (value.sort === "price-asc") return a.price - b.price || a.order - b.order;
      if (value.sort === "price-desc") return b.price - a.price || a.order - b.order;
      if (value.sort === "new") return Number(b.isNew) - Number(a.isNew) || a.order - b.order;
      if (value.sort === "discount") {
        const discount = item => item.oldPrice ? (item.oldPrice - item.price) / item.oldPrice : 0;
        return discount(b) - discount(a) || a.order - b.order;
      }
      return a.order - b.order;
    });
  }
  function noun(count) {
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 14) return "товаров";
    if (count % 10 === 1) return "товар";
    if (count % 10 >= 2 && count % 10 <= 4) return "товара";
    return "товаров";
  }
  function groups(value) {
    return Number(value.min !== "" || value.max !== "") + Number(value.discount) + Number(!!value.gender.length) + Number(!!value.type.length);
  }
  function priceLabel(value) {
    const format = number => Number(number).toLocaleString("ru-RU");
    if (value.min !== "" && value.max !== "") return format(value.min) + "–" + format(value.max) + " ₽";
    if (value.min !== "") return "От " + format(value.min) + " ₽";
    if (value.max !== "") return "До " + format(value.max) + " ₽";
    return "Цена";
  }
  function labelFor(key, values) {
    const title = key === "gender" ? "Для кого" : "Тип товара";
    if (values.length === 1) {
      const option = root.querySelector('[data-filter-option="' + key + '"][value="' + values[0] + '"]');
      return option?.closest("label").querySelector(".catalog-option__name").textContent || title;
    }
    return values.length ? title + " · " + values.length : title;
  }
  function syncInputs(scope, value) {
    root.querySelectorAll('[data-filter-option][data-scope="' + scope + '"]').forEach(input => {
      input.checked = value[input.dataset.filterOption].includes(input.value);
      const count = items.filter(item => matches(item, value, input.dataset.filterOption) && item[input.dataset.filterOption] === input.value).length;
      input.disabled = count === 0;
      input.closest("label").querySelector("[data-facet-count]").textContent = count;
    });
    root.querySelector('[data-price-min][data-scope="' + scope + '"]').value = value.min;
    root.querySelector('[data-price-max][data-scope="' + scope + '"]').value = value.max;
    const prices = items.map(item => item.price);
    root.querySelector('[data-price-min][data-scope="' + scope + '"]').placeholder = Math.min(...prices).toLocaleString("ru-RU");
    root.querySelector('[data-price-max][data-scope="' + scope + '"]').placeholder = Math.max(...prices).toLocaleString("ru-RU");
  }
  function syncControls() {
    syncInputs("desktop", state);
    root.querySelector("[data-discount-toggle]").setAttribute("aria-pressed", String(state.discount));
    for (const key of ["price", "discount", "gender", "type"]) {
      const group = root.querySelector('[data-filter-group="' + key + '"]');
      if (!group) continue;
      const selected = key === "price" ? state.min !== "" || state.max !== "" : key === "discount" ? state.discount : state[key].length > 0;
      group.querySelector(".catalog-chip").classList.toggle("is-selected", selected);
      group.querySelector("[data-clear-group]").hidden = !selected;
      const label = group.querySelector("[data-chip-label]");
      if (label) label.textContent = key === "price" ? priceLabel(state) : labelFor(key, state[key]);
    }
    const activeGroups = groups(state);
    root.querySelector("[data-mobile-filter-label]").textContent = activeGroups ? "Фильтры · " + activeGroups : "Фильтры";
    root.querySelector(".catalog-toolbar__reset").hidden = !activeGroups;
    const selectedSort = root.querySelector('[data-sort="' + state.sort + '"]');
    root.querySelector("[data-sort-label]").textContent = selectedSort?.firstChild.textContent.trim() || "Популярное";
    root.querySelectorAll("[data-sort]").forEach(button => {
      const selected = button.dataset.sort === state.sort;
      button.setAttribute("aria-pressed", String(selected));
      button.querySelector("[data-sort-check]").hidden = !selected;
    });
  }

  function render() {
    ++version;
    const result = filtered();
    const visible = new Set(result.slice(0, state.shown));
    items.forEach(item => item.element.hidden = !visible.has(item));
    // Перемещаются существующие узлы: ссылки, обработчики и доступные названия сохраняются.
    result.forEach(item => grid.append(item.element));
    root.querySelector("[data-catalog-count]").textContent = result.length + " " + noun(result.length);
    root.querySelector("[data-catalog-empty]").hidden = result.length !== 0;
    grid.hidden = result.length === 0;
    root.querySelector("[data-catalog-sort]").hidden = result.length === 0;
    more.hidden = result.length <= pageSize;
    moreButton.hidden = state.shown >= result.length;
    moreButton.disabled = false;
    moreButton.removeAttribute("aria-busy");
    const shown = Math.min(state.shown, result.length);
    root.querySelector("[data-catalog-progress]").textContent = shown >= result.length
      ? "Показаны все " + result.length + " " + noun(result.length)
      : "Показано " + shown + " из " + result.length + " " + noun(result.length);
    root.querySelector("[data-catalog-status]").textContent = "Найдено: " + result.length + ". Показано: " + shown + ".";
    syncControls();
    document.dispatchEvent(new CustomEvent("desisan:catalog-changed", { detail: { filters: clone(state), total: result.length, shown } }));
  }
  function apply(value, replace = false) {
    state = clone(value);
    state.shown = pageSize;
    loadError.hidden = true;
    render();
    updateAddress(replace);
  }

  function closePopovers() {
    allPopovers.forEach(popover => popover.hidden = true);
    root.querySelectorAll("[data-popover-toggle], [data-sort-toggle]").forEach(button => button.setAttribute("aria-expanded", "false"));
  }
  function togglePopover(id, button) {
    const popover = document.getElementById(id);
    const shouldOpen = popover.hidden;
    closePopovers();
    if (shouldOpen) {
      popover.hidden = false;
      button.setAttribute("aria-expanded", "true");
      if (id === "price-popover") syncInputs("desktop", state);
    }
  }
  root.querySelectorAll("[data-popover-toggle]").forEach(button => {
    button.addEventListener("click", () => togglePopover(button.dataset.popoverToggle, button));
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".catalog-filter, .catalog-sort")) closePopovers();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const open = allPopovers.find(item => !item.hidden);
    if (!open) return;
    const trigger = root.querySelector('[aria-controls="' + open.id + '"]');
    closePopovers();
    trigger?.focus();
  });
  function validPrice(value) {
    return (value.min === "" || Number(value.min) >= 0) && (value.max === "" || Number(value.max) >= 0)
      && (value.min === "" || value.max === "" || Number(value.min) <= Number(value.max));
  }
  root.querySelector("[data-desktop-price]").addEventListener("submit", event => {
    event.preventDefault();
    const value = clone(state);
    value.min = event.currentTarget.querySelector("[data-price-min]").value;
    value.max = event.currentTarget.querySelector("[data-price-max]").value;
    root.querySelector("[data-price-error]").hidden = validPrice(value);
    if (!validPrice(value)) return;
    apply(value);
    closePopovers();
  });
  root.querySelector("[data-discount-toggle]").addEventListener("click", () => apply({ ...state, discount: !state.discount }));
  root.querySelectorAll('[data-filter-option][data-scope="desktop"]').forEach(input => {
    input.addEventListener("change", () => {
      const key = input.dataset.filterOption;
      const value = clone(state);
      value[key] = [...root.querySelectorAll('[data-filter-option="' + key + '"][data-scope="desktop"]:checked')].map(item => item.value);
      apply(value);
    });
  });
  root.querySelectorAll("[data-clear-group]").forEach(button => button.addEventListener("click", () => {
    const value = clone(state);
    const key = button.dataset.clearGroup;
    if (key === "price") { value.min = ""; value.max = ""; }
    else value[key] = key === "discount" ? false : [];
    apply(value);
    closePopovers();
  }));
  root.querySelectorAll("[data-reset-filters]").forEach(button => button.addEventListener("click", () => {
    apply({ ...defaults(), sort: state.sort });
    closePopovers();
  }));

  // Мобильное окно редактирует отдельный черновик. Закрытие его не применяет.
  function readDraft() {
    const value = clone(draft);
    value.min = filtersDialog.querySelector("[data-price-min]").value;
    value.max = filtersDialog.querySelector("[data-price-max]").value;
    value.discount = filtersDialog.querySelector("[data-draft-discount]").checked;
    for (const key of ["gender", "type"]) {
      value[key] = [...filtersDialog.querySelectorAll('[data-filter-option="' + key + '"]:checked')].map(input => input.value);
    }
    return value;
  }
  function renderDraft() {
    syncInputs("mobile", draft);
    filtersDialog.querySelector("[data-draft-discount]").checked = draft.discount;
    const valid = validPrice(draft);
    filtersDialog.querySelector("[data-draft-price-error]").hidden = valid;
    const button = filtersDialog.querySelector("[data-apply-draft]");
    button.disabled = !valid;
    const count = filtered(draft).length;
    button.textContent = "Показать " + count + " " + noun(count);
  }
  filtersDialog.addEventListener("desisan:open", () => { closePopovers(); draft = clone(state); renderDraft(); });
  filtersDialog.addEventListener("input", () => { draft = readDraft(); renderDraft(); });
  filtersDialog.querySelector("[data-reset-draft]").addEventListener("click", () => {
    draft = { ...defaults(), sort: state.sort };
    renderDraft();
  });
  filtersDialog.querySelector("[data-apply-draft]").addEventListener("click", () => {
    draft = readDraft();
    if (!validPrice(draft)) return;
    apply(draft);
    dialogs.close(filtersDialog);
  });

  root.querySelector("[data-sort-toggle]").addEventListener("click", event => {
    const trigger = event.currentTarget;
    if (desktop.matches) togglePopover("catalog-sort-menu", trigger);
    else {
      closePopovers();
      dialogs.open("catalog-sort-dialog", trigger);
      trigger.setAttribute("aria-expanded", "true");
    }
  });
  sortDialog.addEventListener("close", () => root.querySelector("[data-sort-toggle]").setAttribute("aria-expanded", "false"));
  root.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => {
    apply({ ...state, sort: button.dataset.sort });
    closePopovers();
    dialogs.close(sortDialog);
  }));
  sortDialog.addEventListener("click", event => {
    if (event.target !== sortDialog) return;
    const box = sortDialog.getBoundingClientRect();
    if (event.clientY < box.top) dialogs.close(sortDialog);
  });
  let touchStartY = 0;
  sortDialog.querySelector("[data-sort-swipe]").addEventListener("pointerdown", event => {
    touchStartY = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  });
  sortDialog.querySelector("[data-sort-swipe]").addEventListener("pointerup", event => {
    if (event.clientY - touchStartY > 48) dialogs.close(sortDialog);
  });

  // Скелетоны появляются только на время реальной асинхронной операции.
  // В демонстрации карточки уже собраны в HTML. Для AJAX Битрикс предусмотрен
  // beforeCatalogLoad({ filters, offset, limit }): Promise<void>.
  moreButton.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    const requestVersion = version;
    const count = Math.min(pageSize, filtered().length - state.shown);
    const skeletons = [];
    loadError.hidden = true;
    moreButton.disabled = true;
    moreButton.setAttribute("aria-busy", "true");
    for (let index = 0; index < count; index++) {
      const skeleton = document.createElement("li");
      skeleton.className = "catalog-skeleton";
      skeleton.setAttribute("aria-hidden", "true");
      skeleton.innerHTML = '<div class="catalog-skeleton__media"></div><div class="catalog-skeleton__caption"></div>';
      grid.append(skeleton);
      skeletons.push(skeleton);
    }
    try {
      const beforeLoad = window.DesisanIntegrations?.beforeCatalogLoad;
      if (typeof beforeLoad === "function") await beforeLoad({ filters: clone(state), offset: state.shown, limit: count });
      else await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (requestVersion !== version) return;
      state.shown += count;
      render();
      updateAddress(true);
    } catch {
      if (requestVersion === version) loadError.hidden = false;
    } finally {
      skeletons.forEach(item => item.remove());
      busy = false;
      moreButton.disabled = false;
      moreButton.removeAttribute("aria-busy");
    }
  });

  // Фильтры — часть адреса. Возврат из карточки восстанавливает раскрытую часть списка.
  window.addEventListener("popstate", () => { state = readAddress(); closePopovers(); render(); });
  const scrollKey = () => "desisan-catalog-scroll:" + location.pathname + location.search;
  window.addEventListener("pagehide", () => {
    try { sessionStorage.setItem(scrollKey(), String(window.scrollY)); } catch {}
  });
  const fromHistory = performance.getEntriesByType("navigation")[0]?.type === "back_forward";
  render();
  if (fromHistory) {
    try {
      const top = Number(sessionStorage.getItem(scrollKey())) || 0;
      requestAnimationFrame(() => window.scrollTo(0, top));
    } catch {}
  }
  desktop.addEventListener("change", () => {
    closePopovers();
    if (desktop.matches) {
      dialogs.close(filtersDialog);
      dialogs.close(sortDialog);
    }
  });
}

