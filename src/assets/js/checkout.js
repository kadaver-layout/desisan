// Локальные состояния формы. Создание заказа подключается отдельным адаптером Битрикс.
export function initCheckout() {
  const loadingPage = document.querySelector('[data-checkout-loading-page]');
  if (loadingPage) {
    const retry = loadingPage.querySelector('[data-checkout-retry]');
    const load = async () => {
      if (retry?.disabled) return;
      if (retry) { retry.disabled = true; retry.setAttribute('aria-busy', 'true'); }
      try {
        const adapter = window.DesisanIntegrations?.beforeCheckoutLoad;
        if (adapter) await adapter();
        else await new Promise(resolve => setTimeout(resolve, 450));
        loadingPage.replaceWith(loadingPage.querySelector('template').content.cloneNode(true));
        initCheckout();
      } catch {
        if (retry) { retry.disabled = false; retry.removeAttribute('aria-busy'); }
        else loadingPage.querySelector('[data-checkout-load-status]').textContent = 'Не удалось загрузить данные заказа. Обновите страницу и попробуйте ещё раз.';
      }
    };
    if (retry) retry.addEventListener('click', load);
    else load();
    return;
  }
  const consent = document.querySelector('[data-checkout-consent]');
  const submitButton = document.querySelector('[data-checkout-submit]');
  const form = document.getElementById('checkout-form');

  if (!consent || !submitButton || !form) return;

  form.noValidate = true;
  const fields = [...form.querySelectorAll('input:not([type="radio"]), textarea')];
  const address = form.querySelector('[data-checkout-address]');
  const addressInput = address?.querySelector('input');
  const pickup = form.querySelector('[data-checkout-pickup]');
  const status = document.querySelector('[data-checkout-status]');
  const submitLabel = submitButton.querySelector('[data-checkout-submit-label]');
  const spinner = submitButton.querySelector('[data-checkout-submit-loading]');
  let submitting = false;
  const page = form.closest('[data-checkout-page]');
  let unavailable = page?.dataset.checkoutState === 'sold-out';
  const summary = document.querySelector('.checkout-summary');

  // Высокий итог не закрепляем: кнопка и согласия должны оставаться достижимыми.
  function updateSummaryPosition() {
    const headerBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-bottom')) || 57;
    summary?.classList.toggle('is-too-tall', summary.offsetHeight + Math.max(headerBottom, 0) + 16 > window.innerHeight);
  }
  if (summary) new ResizeObserver(updateSummaryPosition).observe(summary);
  window.addEventListener('resize', updateSummaryPosition);
  window.addEventListener('scroll', updateSummaryPosition, { passive: true });
  updateSummaryPosition();

  function validateField(input) {
    let message = '';
    if (input.required && !input.disabled && !input.value.trim()) message = 'Заполните поле';
    else if (input.type === 'email' && input.validity.typeMismatch) message = 'Введите корректный email';
    else if (input.name === 'phone' && input.value && !/^\+?[\d\s()−-]+$/.test(input.value)) message = 'Введите корректный телефон';
    else if (input.name === 'phone' && input.value && (input.value.replace(/\D/g, '').length < 10 || input.value.replace(/\D/g, '').length > 15)) message = 'Введите телефон полностью';
    const errorId = `checkout-error-${input.name}`;
    let error = document.getElementById(errorId);
    if (message && !error) {
      error = document.createElement('span');
      error.id = errorId;
      error.className = 'checkout-form__error';
      input.after(error);
    }
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorId);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
    return !message;
  }

  fields.forEach(input => {
    input.addEventListener('blur', () => {
      if (input.value.trim() || input.hasAttribute('aria-invalid')) validateField(input);
    });
    input.addEventListener('input', () => {
      if (input.hasAttribute('aria-invalid')) validateField(input);
    });
  });

  consent.addEventListener('change', () => {
    submitButton.disabled = submitting || unavailable || !consent.checked;
  });

  function updateDelivery() {
    const input = form.querySelector('[name="delivery"]:checked');
    const isPickup = input?.value === 'Самовывоз';
    const delivery = document.querySelector('[data-checkout-delivery]');
    if (delivery) delivery.textContent = isPickup ? 'Самовывоз' : 'ТК или почтой';
    if (pickup) pickup.hidden = !isPickup;
    if (address) address.hidden = isPickup;
    if (addressInput) {
      addressInput.required = !isPickup;
      addressInput.disabled = isPickup;
      if (isPickup) validateField(addressInput);
    }
  }
  form.querySelectorAll('[name="delivery"]').forEach(input => input.addEventListener('change', updateDelivery));
  updateDelivery();

  function showStatus(message) {
    status.hidden = !message;
    status.textContent = message;
  }

  function setSubmitting(busy) {
    submitting = busy;
    form.setAttribute('aria-busy', String(busy));
    // Form.elements включает согласия вне формы, связанные через атрибут form.
    [...form.elements].forEach(control => {
      if (control === submitButton) return;
      if (busy) {
        control.dataset.checkoutWasDisabled = String(control.disabled);
        control.disabled = true;
      } else {
        control.disabled = control.dataset.checkoutWasDisabled === 'true';
        delete control.dataset.checkoutWasDisabled;
      }
    });
    submitButton.disabled = busy || unavailable || !consent.checked;
    submitButton.setAttribute('aria-busy', String(busy));
    submitButton.setAttribute('aria-label', busy ? 'Оформляем заказ' : 'Оформить заказ');
    submitLabel.hidden = busy;
    spinner.hidden = !busy;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    const invalidFields = fields.filter(input => !validateField(input));
    if (invalidFields.length) {
      invalidFields[0].focus();
      return;
    }
    if (!consent.checked || unavailable) return;
    // До создания заказа подтверждаем актуальные цены и доступность.
    const validate = window.DesisanIntegrations?.validateCheckout;
    if (validate) {
      const draft = new FormData(form);
      setSubmitting(true);
      try {
        const result = await validate(draft);
        if (result?.changed || result?.available === false || result?.valid === false) {
          unavailable = result.available === false;
          const notice = page.querySelector('[data-checkout-notice]');
          notice.hidden = false;
          notice.textContent = result.message || (unavailable ? 'Один товар больше недоступен. Вернитесь в корзину и измените состав.' : 'Цена одного товара изменилась. Проверьте обновлённый итог и подтвердите заказ.');
          const currency = value => new Intl.NumberFormat('ru-RU').format(value) + '\u00a0₽';
          for (const [key, hook] of [['total','total'], ['subtotal','subtotal'], ['discount','discount']]) {
            if (Number.isFinite(result[key])) page.querySelector(`[data-checkout-${hook}]`).textContent = (key === 'discount' ? '−' : '') + currency(result[key]);
          }
          for (const item of result.items || []) {
            const price = [...page.querySelectorAll('[data-checkout-item-price]')].find(node => node.dataset.checkoutItemId === String(item.id));
            if (price && Number.isFinite(item.price)) price.textContent = currency(item.price);
          }
          notice.scrollIntoView({block:'nearest'});
          setSubmitting(false);
          return;
        }
      } catch {
        setSubmitting(false);
        showStatus('Не удалось проверить состав заказа. Попробуйте ещё раз.');
        return;
      }
      setSubmitting(false);
    }
    // Адаптер возвращает подтверждённый результат. Без него запрос не отправляется.
    // Сетевая ошибка после отправки не означает, что заказ не был создан.
    const adapter = window.DesisanIntegrations?.createOrder;
    if (!adapter) {
      showStatus('Не удалось оформить заказ. Попробуйте ещё раз.');
      return;
    }
    const values = new FormData(form);
    const attemptId = crypto.randomUUID();
    setSubmitting(true);
    showStatus('');
    try {
      const result = await adapter(values, { attemptId });
      if (result?.status === 'created' && result.url) {
        window.location.assign(result.url);
        return;
      }
      if (result?.status === 'not-created') {
        setSubmitting(false);
        showStatus('Не удалось оформить заказ. Попробуйте ещё раз.');
        return;
      }
    } catch {
      // Не повторяем createOrder: проверяем ту же попытку по её идентификатору.
    }
    showStatus('Проверяем, создан ли заказ. Не отправляйте его повторно.');
    const checkStatus = window.DesisanIntegrations?.getOrderStatus;
    if (checkStatus) {
      try {
        const result = await checkStatus({ attemptId });
        if (result?.status === 'created' && result.url) {
          window.location.assign(result.url);
          return;
        }
        if (result?.status === 'not-created') {
          setSubmitting(false);
          showStatus('Не удалось оформить заказ. Попробуйте ещё раз.');
          return;
        }
      } catch {
        // Неизвестный результат сохраняет блокировку повторной отправки.
      }
    }
    showStatus('Не удалось проверить статус заказа. Позвоните в магазин: 8 800 555-04-10. Не отправляйте заказ повторно.');
  });
  // Отдельные страницы сохраняют состояния из макета для проверки и интеграции.
  const preview = page?.dataset.checkoutState;
  if (preview === 'validation') fields.forEach(validateField);
  if (preview === 'error') showStatus('Не удалось оформить заказ. Попробуйте ещё раз.');
  if (preview === 'sending' || preview === 'checking') {
    setSubmitting(true);
    if (preview === 'checking') showStatus('Проверяем, создан ли заказ. Не отправляйте его повторно.');
  } else submitButton.disabled = unavailable || !consent.checked;
}
