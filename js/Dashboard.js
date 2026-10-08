// js/Dashboard.js
import { ToDoWidget } from './ToDoWidget.js';
import { StandingsWidget } from './StandingsWidget.js';
import { RaceCalendarWidget } from './RaceCalendarWidget.js';
import { TrackInfoWidget } from './TrackInfoWidget.js';
import { NextRaceWidget } from './NextRaceWidget.js';
/**
 * Класс, управляющий всей панелью виджетов.
 * Хранит коллекцию активных виджетов и отвечает за их отрисовку.
 */
export class Dashboard {
  /**
   * @param {HTMLElement} container — DOM-элемент, в который рендерятся виджеты
   */
  constructor(container) {
    if (!container) throw new Error('Dashboard: контейнер не передан');

    /** @type {HTMLElement} */
    this.container = container;

    /** @type {Map<string, import('./UIComponent.js').UIComponent>} */
    this.widgets = new Map();

    /** Счётчик для генерации уникальных ID */
    this._counter = 0;
  }

  /**
   * Реестр доступных типов виджетов.
   * Чтобы добавить новый виджет — достаточно дописать сюда одну строку.
   * (принцип открытости/закрытости)
   */
  static WIDGET_TYPES = {
    todo:      { Class: ToDoWidget,         title: 'Мои гонки' },
    standings: { Class: StandingsWidget,    title: 'Положение пилотов' },
    calendar:  { Class: RaceCalendarWidget, title: 'Расписание сезона' },
    nextrace: { Class: NextRaceWidget, title: 'Следующая гонка' },
    track:     { Class: TrackInfoWidget,    title: 'Информация о трассе' },
  };

  /**
   * Добавляет виджет указанного типа.
   * @param {'todo'|'standings'|'calendar'|'track'} widgetType
   * @returns {import('./UIComponent.js').UIComponent|null}
   */
  addWidget(widgetType) {
    const config = Dashboard.WIDGET_TYPES[widgetType];

    if (!config) {
      console.warn(`Dashboard: неизвестный тип виджета "${widgetType}"`);
      return null;
    }

    const id = `${widgetType}-${++this._counter}`;
    const widget = new config.Class({ id, title: config.title });

    // Прокидываем виджету callback для самоудаления
    widget.onCloseRequest = (widgetId) => this.removeWidget(widgetId);
    this._wireWidgetCallbacks(widget);
    // Рендер и вставка в DOM
    const el = widget.render();
    this.container.appendChild(el);

    // Сохраняем в коллекцию
    this.widgets.set(id, widget);

    return widget;
  }

  /**
   * Удаляет виджет по ID: вызывает destroy() и убирает из коллекции.
   * @param {string} widgetId
   * @returns {boolean} true, если виджет был найден и удалён
   */
    /**
   * Сдвигает виджет влево/вправо в DOM (для кнопочной альтернативы).
   * @param {string} widgetId
   * @param {-1|1} direction
   */
  moveWidget(widgetId, direction) {
    const el = this.container.querySelector(`[data-widget-id="${widgetId}"]`);
    if (!el) return;

    if (direction === -1) {
      const prev = el.previousElementSibling;
      if (prev) this.container.insertBefore(el, prev);
    } else {
      const next = el.nextElementSibling;
      if (next) this.container.insertBefore(next, el);
    }

    // Возвращаем фокус на кнопку перемещения, чтобы не терялся
    const btn = el.querySelector(`[data-action="move-${direction === -1 ? 'left' : 'right'}"]`);
    if (btn) btn.focus();
  }

  /**
   * Меняет порядок виджетов при drag-n-drop.
   * @param {string} draggedId — ID перетаскиваемого
   * @param {string} targetId  — ID виджета, на который бросили
   */
  reorderWidgets(draggedId, targetId) {
    const draggedEl = this.container.querySelector(`[data-widget-id="${draggedId}"]`);
    const targetEl = this.container.querySelector(`[data-widget-id="${targetId}"]`);
    if (!draggedEl || !targetEl || draggedEl === targetEl) return;

    // Определяем, куда вставлять: до или после target
    const draggedIndex = [...this.container.children].indexOf(draggedEl);
    const targetIndex = [...this.container.children].indexOf(targetEl);

    if (draggedIndex < targetIndex) {
      this.container.insertBefore(draggedEl, targetEl.nextSibling);
    } else {
      this.container.insertBefore(draggedEl, targetEl);
    }
  }

  /**
   * Прокидывает виджетам callback'и для перемещения.
   * Вызывается в addWidget после создания виджета.
   * @private
   */
  _wireWidgetCallbacks(widget) {
    widget.onMoveRequest = (id, dir) => this.moveWidget(id, dir);
    widget.onDropRequest = (draggedId, targetId) => this.reorderWidgets(draggedId, targetId);
  }
}