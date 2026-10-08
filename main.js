// main.js
import { Dashboard } from './js/Dashboard.js';

/**
 * Точка входа приложения.
 * Создаёт Dashboard, вешает обработчики на кнопки добавления виджетов
 * и добавляет стартовый набор виджетов.
 */
function init() {
  const container = document.getElementById('dashboard');
  if (!container) {
    console.error('Не найден контейнер #dashboard');
    return;
  }

  const dashboard = new Dashboard(container);

  // Делегирование кликов по тулбару
  const toolbar = document.querySelector('.app-toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-add]');
      if (!btn) return;
      const type = btn.dataset.add;
      dashboard.addWidget(type);
    });
  }

  // Стартовый набор виджетов — чтобы дашборд не был пустым
  dashboard.addWidget('standings');
  dashboard.addWidget('calendar');
  dashboard.addWidget('track');
  dashboard.addWidget('nextrace');
  dashboard.addWidget('todo');

  // Для отладки — можно посмотреть в консоли
  window.__dashboard = dashboard;
}

// Запускаем, когда DOM готов (скрипт в конце body, но подстрахуемся)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}