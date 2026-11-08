// Повтор читает уже созданный заказ. Создание и очистка корзины здесь запрещены.
/**
 * Битрикс: getOrderResult(): Promise<{ html }> возвращает серверный фрагмент,
 * содержащий main.order-success. URL/токен заказа адаптер берёт из текущей
 * защищённой страницы. Проверка владельца/токена обязательна на сервере.
 * HTML должен быть доверенным, с экранированными пользовательскими значениями:
 * DOMParser не является средством очистки HTML. Скрипты внутри фрагмента
 * не используйте; общий app.js уже подключён. Эта операция только читает заказ.
 */
export function initOrderResult() {
  const button = document.querySelector('[data-order-result-retry]');
  if (!button) return;
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const label = button.textContent;
    button.textContent = 'Обновляем…';
    try {
      const adapter = window.DesisanIntegrations?.getOrderResult;
      if (!adapter) return;
      // HTML формирует шаблон компонента Битрикс с проверкой доступа к заказу.
      const result = await adapter();
      const document = new DOMParser().parseFromString(result?.html || '', 'text/html');
      const content = document.querySelector('main.order-success');
      if (!content) throw new Error('Order result markup is missing');
      button.closest('main').replaceWith(content);
      initOrderResult();
      const heading = content.querySelector('h1');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
    } catch {
      // Ошибка не подтверждает отсутствие заказа и не вызывает createOrder.
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = label;
    }
  });
}
