// Форма не имитирует успешную отправку: результат подтверждает серверный адаптер.
/**
 * Битрикс: sendContactMessage(FormData, { attemptId }) и
 * getContactMessageStatus({ attemptId }) возвращают { status: 'sent' | 'not-sent' }.
 * 'sent' означает подтверждённое принятие сервером, а не гарантированную доставку.
 * При неизвестном результате форма остаётся заблокированной во избежание дублей.
 * Сервер проверяет поля, согласие, сессию, частоту отправок и права.
 * Карта ниже — статическое изображение с повтором загрузки, не API карт.
 * Не инициализировать повторно существующий DOM; страницы состояний — примеры.
 */
export function initContacts() {
  const root = document.querySelector('[data-contacts-root]');
  if (!root) return;
  const form = root.querySelector('[data-contacts-form]');
  const consent = form.querySelector('[data-contacts-consent]');
  const submit = form.querySelector('[data-contacts-submit]');
  const fields = [...form.querySelectorAll('input:not([type="checkbox"]), textarea')];
  const status = root.querySelector('[data-contacts-status]');
  const success = root.querySelector('[data-contacts-success]');
  let busy = false;

  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    [...form.elements].forEach(control => { control.disabled = value; });
    submit.disabled = value || !consent.checked;
    submit.setAttribute('aria-busy', String(value));
    submit.setAttribute('aria-label', value ? 'Отправляем сообщение' : 'Отправить сообщение');
    submit.querySelector('[data-contacts-spinner]').hidden = !value;
    submit.querySelector('[data-contacts-submit-label]').hidden = value;
  }
  function showStatus(unknown = false) {
    status.hidden = false;
    root.querySelector('[data-contacts-status-title]').textContent = unknown ? 'Не удалось подтвердить отправку' : 'Не удалось отправить сообщение';
    root.querySelector('[data-contacts-status-text]').textContent = unknown ? 'Не отправляйте сообщение повторно, пока проверяется результат. Если статус не обновится, свяжитесь с нами по телефону.' : 'Ваши данные сохранены. Попробуйте ещё раз или свяжитесь с нами по телефону.';
  }
  function validate(input) {
    let message = '';
    if (!input.value.trim()) message = 'Заполните поле';
    else if (input.type === 'email' && input.validity.typeMismatch) message = 'Введите корректный email';
    const id = `contacts-error-${input.name}`;
    let error = root.querySelector(`#${id}`);
    if (message && !error) {
      error = document.createElement('span');
      error.id = id;
      error.className = 'contacts-form__error';
      input.after(error);
    }
    if (error) { error.textContent = message; error.hidden = !message; }
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
    return !message;
  }
  fields.forEach(input => {
    input.addEventListener('blur', () => { if (input.value || input.hasAttribute('aria-invalid')) validate(input); });
    input.addEventListener('input', () => { if (input.hasAttribute('aria-invalid')) validate(input); });
  });
  consent.addEventListener('change', () => { submit.disabled = busy || !consent.checked; });
  const message = form.elements.message;
  const counter = root.querySelector('[data-contacts-counter]');
  function updateCounter() {
    counter.hidden = message.value.length < 1800;
    counter.textContent = `${message.value.length} / ${message.maxLength}`;
  }
  message.addEventListener('input', updateCounter);
  message.addEventListener('paste', event => {
    const pasted = event.clipboardData?.getData('text') || '';
    const selectedLength = message.selectionEnd - message.selectionStart;
    if (message.value.length - selectedLength + pasted.length > message.maxLength) {
      // Браузер ограничит вставку; пояснение сообщает, почему текст принят не целиком.
      showStatus();
      root.querySelector('[data-contacts-status-title]').textContent = 'Сообщение слишком длинное';
      root.querySelector('[data-contacts-status-text]').textContent = 'Можно ввести не более 2000 символов. Часть вставленного текста не добавлена.';
    }
  });
  root.querySelector('[data-contacts-reset]').addEventListener('click', () => {
    form.reset();
    fields.forEach(input => { input.value = ''; input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); });
    consent.checked = false;
    root.querySelectorAll('.contacts-form__error').forEach(error => error.remove());
    setBusy(false);
    success.hidden = true;
    status.hidden = true;
    form.hidden = false;
    updateCounter();
    fields[0].focus();
  });
  function acceptResult(result, email) {
    if (result?.status === 'sent') {
      setBusy(false);
      form.hidden = true;
      status.hidden = true;
      success.hidden = false;
      root.querySelector('[data-contacts-email]').textContent = email;
      success.setAttribute('tabindex', '-1');
      success.focus();
      return true;
    }
    if (result?.status === 'not-sent') {
      setBusy(false);
      showStatus();
      return true;
    }
    return false;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const invalid = fields.filter(input => !validate(input));
    if (invalid.length) { invalid[0].focus(); return; }
    if (!consent.checked) return;
    const adapter = window.DesisanIntegrations?.sendContactMessage;
    if (!adapter) { showStatus(); return; }
    const values = new FormData(form);
    const email = form.elements.email.value;
    const attemptId = crypto.randomUUID();
    // Одна попытка отправки и её проверка используют один ключ.
    // Для восстановления после reload ключ/результат нужно хранить на сервере:
    // текущая верстка держит его только до закрытия страницы.
    setBusy(true);
    status.hidden = true;
    try {
      if (acceptResult(await adapter(values, { attemptId }), email)) return;
    } catch { /* Потеря ответа не подтверждает отказ сервера. */ }
    showStatus(true);
    const check = window.DesisanIntegrations?.getContactMessageStatus;
    if (check) {
      try { acceptResult(await check({ attemptId }), email); } catch { /* Повторную отправку не разрешаем до подтверждённого результата. */ }
    }
  });

  if (root.dataset.contactsState === 'validation') fields.forEach(validate);
  if (root.dataset.contactsState === 'long') message.value = contactsLongMessage();
  setBusy(['sending', 'checking'].includes(root.dataset.contactsState));
  updateCounter();
  initContactsMap();
}

function contactsLongMessage() {
  return 'Здравствуйте! Подскажите, пожалуйста, условия доставки и самовывоза. '.repeat(40).slice(0, 2000);
}

function initContactsMap() {
  const map = document.querySelector('[data-contacts-map]');
  if (!map) return;
  const image = map.querySelector('[data-contacts-map-image]');
  const loading = map.querySelector('[data-contacts-map-loading]');
  const error = map.querySelector('[data-contacts-map-error]');
  function finish(failed) {
    map.setAttribute('aria-busy', 'false');
    loading.hidden = true;
    image.hidden = failed;
    error.hidden = !failed;
  }
  image.addEventListener('error', () => finish(true));
  map.querySelector('[data-contacts-map-retry]').addEventListener('click', () => {
    error.hidden = true;
    image.hidden = true;
    loading.hidden = false;
    map.setAttribute('aria-busy', 'true');
    const retryImage = new Image();
    retryImage.onload = () => finish(false);
    retryImage.onerror = () => finish(true);
    retryImage.src = image.src;
  });
}
