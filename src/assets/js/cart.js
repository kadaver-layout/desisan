// Демонстрационный пересчёт корзины. В Битрикс обработчики заменяются ответом
// корзины сервера: разметка и data-атрибуты оставлены точками интеграции.
/**
 * Битрикс: корень [data-cart-page], строки [data-cart-item].
 * data-cart-price / data-cart-old-price — числовая цена ОДНОЙ единицы в рублях.
 * Количество хранится отдельно; render() умножает цену на подтверждённое количество.
 * Сейчас ID позиции берётся из href первой ссылки строки. При интеграции замените
 * оба чтения ID и сопоставление validateCart на единый ID строки корзины:
 * ссылка товара не различает несколько позиций одного SKU с разными свойствами.
 * Не запускайте initCartPage повторно на том же DOM: слушатели продублируются.
 */
export function initCartPage() {
  const page = document.querySelector("[data-cart-page]");
  if (!page) return;
  // Заглушка уже находится в HTML: ошибка загрузки не меняет размер карточки и ссылку.
  const showImagePlaceholder = image => {
    image.hidden = true;
    image.parentElement.querySelector("[data-cart-image-placeholder]").hidden = false;
  };
  page.querySelectorAll("[data-cart-image]").forEach(image => {
    image.addEventListener("error", () => showImagePlaceholder(image));
    if (image.complete && !image.naturalWidth) showImagePlaceholder(image);
  });
  const retry = page.querySelector("[data-cart-retry]");
  const loadCart = async () => {
    if (retry?.disabled) return;
    if (retry) {
    retry.disabled = true;
    retry.setAttribute("aria-busy", "true");
    retry.querySelector("[data-cart-retry-label]").hidden = true;
    retry.querySelector("[data-cart-retry-loading]").hidden = false;
    }
    try {
      // Интегратор подтверждает загрузку до показа подготовленной разметки.
      const adapter = window.DesisanIntegrations?.beforeCartLoad;
      // Это ожидание, а не загрузчик HTML: возвращаемое значение здесь не читается.
      // Ниже раскрывается готовый template. Для живой корзины замените эту ветку
      // серверным HTML компонента и затем один раз инициализируйте новый корень.
      if (adapter) await adapter();
      else await new Promise(resolve => setTimeout(resolve, 450));
      const template = page.querySelector('[data-cart-ready]');
      if (!template) return;
      page.replaceWith(template.content.cloneNode(true));
      initCartPage();
    } catch {
      if (retry) {
        retry.disabled = false;
        retry.removeAttribute('aria-busy');
        retry.querySelector('[data-cart-retry-label]').hidden = false;
        retry.querySelector('[data-cart-retry-loading]').hidden = true;
      }
    }
  };
  retry?.addEventListener('click', loadCart);
  if (page.querySelector('[data-cart-ready]') && !retry) loadCart();
  if (page.hasAttribute("data-cart-preview")) return;
  const formatter = new Intl.NumberFormat("ru-RU");
  const format = value => formatter.format(value) + "\u00a0₽";
  const quantities = new WeakMap();
  const pendingItems = new WeakSet();
  let checking = false;
  page.querySelectorAll("[data-cart-item]").forEach(item => {
    quantities.set(item, Number(item.querySelector("[data-cart-quantity]").value) || 1);
  });
  const quantityLabel = count => {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return `${count} товаров`;
    if (last === 1) return `${count} товар`;
    return `${count} ${last >= 2 && last <= 4 ? "товара" : "товаров"}`;
  };
  const render = () => {
    const items = [...page.querySelectorAll("[data-cart-item]")];
    const updating = checking || items.some(item => pendingItems.has(item));
    let total = 0, oldTotal = 0, count = 0;
    items.forEach(item => {
      const quantity = quantities.get(item);
      const pending = pendingItems.has(item);
      item.querySelector('[data-cart-unavailable-note]').hidden = !item.hasAttribute('data-cart-unavailable');
      const price = Number(item.dataset.cartPrice);
      const oldPrice = Number(item.dataset.cartOldPrice);
      count += quantity; total += price * quantity; oldTotal += (oldPrice || price) * quantity;
      item.querySelector("[data-cart-line-price]").textContent = format(price * quantity);
      const oldLinePrice = item.querySelector("[data-cart-line-old-price]");
      if (oldLinePrice) oldLinePrice.textContent = format(oldPrice * quantity);
      const unitPrice = item.querySelector("[data-cart-unit-price]");
      unitPrice.hidden = quantity <= 1;
      unitPrice.textContent = `${format(price)} за штуку`;
      item.querySelector("[data-cart-decrease]").disabled = pending || quantity <= 1 || item.hasAttribute("data-cart-unavailable");
      const maximum = Number(item.dataset.cartMaxQuantity) || Infinity;
      item.querySelector("[data-cart-increase]").disabled = pending || quantity >= maximum || item.hasAttribute("data-cart-unavailable");
      item.querySelector("[data-cart-remove]").disabled = pending;
      item.querySelector("[data-cart-quantity]").disabled = pending || item.hasAttribute("data-cart-unavailable");
      const limitNote = item.querySelector("[data-cart-limit-note]");
      if (limitNote) limitNote.hidden = quantity < maximum;
    });
    page.querySelectorAll("[data-cart-count-label]").forEach(node => {
      node.textContent = quantityLabel(count);
      node.hidden = count === 0;
    });
    document.querySelectorAll("[data-cart-count]").forEach(node => {
      node.textContent = count;
      node.hidden = count === 0;
    });
    page.querySelector("[data-cart-total]").textContent = updating ? "Обновляем..." : format(total);
    page.querySelector("[data-cart-old-total]").textContent = format(oldTotal);
    page.querySelector("[data-cart-discount]").textContent = "−" + format(oldTotal - total);
    page.querySelector("[data-cart-discount-row]").hidden = oldTotal === total;
    const empty = !items.length;
    const unavailable = items.some(item => item.hasAttribute("data-cart-unavailable"));
    page.querySelector("[data-cart-checkout]").hidden = unavailable || updating;
    const checkoutDisabled = page.querySelector("[data-cart-checkout-disabled]");
    checkoutDisabled.hidden = !unavailable && !updating;
    checkoutDisabled.setAttribute("aria-busy", String(updating));
    checkoutDisabled.querySelector("[data-cart-checkout-label]").hidden = updating;
    checkoutDisabled.querySelector("[data-cart-checkout-loading]").hidden = !updating;
    page.querySelector("[data-cart-checkout-note]").textContent = unavailable
      ? "Удалите недоступный товар, чтобы перейти к оформлению."
      : "Способ доставки выберете при оформлении заказа.";
    page.querySelector("[data-cart-content]").hidden = empty;
    page.querySelector("[data-cart-empty]").hidden = !empty;
    const recommendations = page.querySelector("[data-cart-recommendations]");
    recommendations.hidden = empty || !recommendations.querySelector("[data-product-card]");
  };
  // Промежуточное состояние показывается сразу после изменения количества.
  // В Битрикс таймер заменяется ожиданием ответа обновления строки корзины.
  const setQuantityPending = (item, pending) => {
    if (pending) pendingItems.add(item);
    else pendingItems.delete(item);
    item.classList.toggle("is-updating", pending);
    item.setAttribute("aria-busy", String(pending));
    item.querySelector("[data-cart-quantity]").disabled = pending;
    render();
  };
  // Enter и потеря фокуса подтверждают ввод. Ноль не удаляет позицию.
  const confirmQuantity = async (input, force = false) => {
    const item = input.closest("[data-cart-item]");
    // Отключение активного поля вызывает focusout. Не запускаем второй
    // пересчёт из этого события, пока первый ещё не завершён.
    if (pendingItems.has(item)) return;
    const value = input.value.trim();
    const quantity = Number(value);
    const valid = /^[0-9]+$/.test(value) && Number.isSafeInteger(quantity) && quantity >= 1;
    // Допустимый максимум приходит с сервера для конкретной позиции, общего лимита нет.
    const overLimit = valid && quantity > (Number(item.dataset.cartMaxQuantity) || Infinity);
    input.setAttribute("aria-invalid", String(!valid || overLimit));
    const error = item.querySelector("[data-cart-quantity-error]");
    error.hidden = valid && !overLimit;
    error.textContent = overLimit ? "Больше добавить не получится" : "Введите целое число от 1";
    if (!valid || overLimit) return;
    input.value = String(quantity);
    const previousQuantity = quantities.get(item);
    if (quantity === previousQuantity && !force) return;
    setQuantityPending(item, true);
    item.querySelector('[data-cart-operation-error]').hidden = true;
    try {
      const adapter = window.DesisanIntegrations?.updateCartItem;
      // Promise<{ quantity?, price?, oldPrice? }>: вернуть серверное количество
      // и цены единицы. При отказе отклонить Promise — поле восстановится,
      // повтор выполнит сохранённое желаемое количество, не перезагрузку страницы.
      const id = item.querySelector('a').getAttribute('href');
      if (adapter) {
        const result = await adapter({ id, quantity });
        quantities.set(item, result?.quantity ?? quantity);
        if (Number.isFinite(result?.price)) item.dataset.cartPrice = result.price;
        if (Number.isFinite(result?.oldPrice)) item.dataset.cartOldPrice = result.oldPrice;
      } else {
        // Локальная демонстрация пересчёта без создания заказа или серверной покупки.
        await new Promise(resolve => setTimeout(resolve, 280));
        quantities.set(item, quantity);
      }
      input.value = String(quantities.get(item));
      item.querySelector('.cart-quantity--error')?.classList.remove('cart-quantity--error');
    } catch {
      input.value = String(previousQuantity);
      item.querySelector('[data-cart-operation-error]').hidden = false;
      item.dataset.cartRetryQuantity = quantity;
    } finally {
      setQuantityPending(item, false);
    }
  };
  async function removeItem(item) {
    const nextItem = item.nextElementSibling || item.previousElementSibling;
    item.querySelector('[data-cart-remove-error]').hidden = true;
    setQuantityPending(item, true);
    try {
      const adapter = window.DesisanIntegrations?.removeCartItem;
      // Удалять строку из DOM можно только после подтверждения сервера.
      // Без адаптера действует локальная демонстрация; это не сохранение корзины.
      if (adapter) await adapter({ id: item.querySelector('a').getAttribute('href') });
      else await new Promise(resolve => setTimeout(resolve, 280));
      item.remove();
      render();
      const nextControl = nextItem?.querySelector('a') || page.querySelector('[data-cart-empty] a');
      nextControl?.focus();
    } catch {
      item.querySelector('[data-cart-remove-error]').hidden = false;
    } finally { if (item.isConnected) setQuantityPending(item, false); }
  }
  page.addEventListener("focusout", event => {
    if (event.target.matches("[data-cart-quantity]")) confirmQuantity(event.target);
  });
  page.addEventListener("keydown", event => {
    const input = event.target.closest("[data-cart-quantity]");
    if (!input) return;
    const item = input.closest("[data-cart-item]");
    if (pendingItems.has(item)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      confirmQuantity(input);
    } else if (event.key === "Escape") {
      input.value = String(quantities.get(item));
      confirmQuantity(input);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      input.value = String(Math.max(1, quantities.get(item) + (event.key === "ArrowUp" ? 1 : -1)));
      confirmQuantity(input);
    }
  });
  page.addEventListener("click", event => {
    const item = event.target.closest("[data-cart-item]");
    if (!item) return;
    if (pendingItems.has(item)) return;
    const quantity = item.querySelector("[data-cart-quantity]");
    const increase = event.target.closest("[data-cart-increase]");
    const decrease = event.target.closest("[data-cart-decrease]");
    if (increase || decrease) {
      quantity.value = String(Math.max(1, quantities.get(item) + (increase ? 1 : -1)));
      confirmQuantity(quantity);
    }
    const removeButton = event.target.closest("[data-cart-remove]");
    if (removeButton?.hasAttribute("data-cart-remove-failed")) {
      item.querySelector("[data-cart-remove-error]").hidden = false;
      return;
    }
    if (event.target.closest("[data-cart-remove-retry]")) {
      item.querySelector("[data-cart-remove]").removeAttribute("data-cart-remove-failed");
      removeItem(item);
      return;
    }
    if (event.target.closest('[data-cart-operation-retry]')) {
      quantity.value = item.dataset.cartRetryQuantity || quantity.value;
      confirmQuantity(quantity, true);
      return;
    }
    if (removeButton) {
      removeItem(item);
    }
  });
  page.querySelector('[data-cart-checkout]').addEventListener('click', async event => {
    event.preventDefault();
    if (checking || page.querySelector('[data-cart-item][aria-busy="true"]')) return;
    const link = event.currentTarget;
    const error = page.querySelector('[data-cart-checkout-error]');
    checking = true;
    error.hidden = true;
    render();
    try {
      const adapter = window.DesisanIntegrations?.validateCart;
      // Ожидается { valid?, changed?, message?, items?: [{ id, price?, oldPrice?, available? }] }.
      // При изменениях показываем новые данные и ждём повторного нажатия.
      // Сервер также обязан проверять корзину при открытии оформления и создании заказа.
      if (adapter) {
        const result = await adapter();
        // Изменившиеся цены и остатки требуют повторного осознанного нажатия.
        for (const update of result?.items || []) {
          const item = [...page.querySelectorAll('[data-cart-item]')].find(row => row.querySelector('a').getAttribute('href') === update.id);
          if (!item) continue;
          if (Number.isFinite(update.price)) item.dataset.cartPrice = update.price;
          if (Number.isFinite(update.oldPrice)) item.dataset.cartOldPrice = update.oldPrice;
          if (typeof update.available === 'boolean') item.toggleAttribute('data-cart-unavailable', !update.available);
        }
        if (result?.valid === false || result?.changed) {
          error.textContent = result.message || 'Состав или цена заказа изменились. Проверьте обновлённую корзину.';
          error.hidden = false;
          error.scrollIntoView({ block: 'nearest' });
          return;
        }
      }
      else await new Promise(resolve => setTimeout(resolve, 280));
      window.location.assign(link.href);
    } catch {
      error.hidden = false;
      error.scrollIntoView({ block: 'nearest' });
    } finally { checking = false; render(); }
  });
  render();
}
