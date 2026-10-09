// js/UIComponent.js

/**
 * Базовый (абстрактный) класс для всех виджетов дашборда.
 * Не должен использоваться напрямую — только через наследников.
 */
export class UIComponent {
  /**
   * @param {Object} config
   * @param {string} config.id       — уникальный ID виджета
   * @param {string} config.title    — заголовок, отображаемый в шапке
   */
  constructor({ id, title }) {
    if (new.target === UIComponent) {
      throw new Error('UIComponent — абстрактный класс, нельзя создавать напрямую');
    }

    this.id = id;
    this.title = title;

    /** @type {HTMLElement|null} корневой DOM-элемент виджета */
    this.element = null;

    /** @type {AbortController|null} для отмены fetch-запросов */
    this.abortController = null;

    /** @type {Array<Function>} очередь очистки слушателей/интервалов */
    this._cleanups = [];

    this._isMinimized = false;
  }

  /**
   * Возвращает DOM-элемент виджета.
   * Переопределяется в наследниках.
   * @returns {HTMLElement}
   */
  render() {
    throw new Error('Метод render() должен быть переопределён в наследнике');
  }

  /**
   * Создаёт «скелет» виджета: обёртку + шапку с кнопками.
   * Наследники используют это внутри своего render().
   * @returns {HTMLElement} корневой элемент .widget
   */
    /**
   * Создаёт «скелет» виджета: обёртку + шапку с кнопками.
   * Наследники используют это внутри своего render().
   * @returns {HTMLElement} корневой элемент .widget
   */
  _createShell() {
    const widget = document.createElement('section');
    widget.className = 'widget';
    widget.dataset.widgetId = this.id;
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', this.title);
    widget.draggable = false;

    widget.innerHTML = `
      <header class="widget-header">
        <div class="widget-drag-area">
          <button class="widget-btn widget-btn-drag" data-action="drag"
                  aria-label="Перетащить виджет" title="Перетащить">⠿</button>
          <h2 class="widget-title">${this.title}</h2>
        </div>
        <div class="widget-controls">
          <button class="widget-btn" data-action="move-left"
                  aria-label="Сдвинуть виджет влево" title="Влево">←</button>
          <button class="widget-btn" data-action="move-right"
                  aria-label="Сдвинуть виджет вправо" title="Вправо">→</button>
          <button class="widget-btn" data-action="minimize" 
                  aria-label="Свернуть виджет" title="Свернуть">–</button>
          <button class="widget-btn widget-btn-close" data-action="close" 
                  aria-label="Закрыть виджет" title="Закрыть">×</button>
        </div>
      </header>
      <div class="widget-body"></div>
    `;

    // --- Делегирование кликов по шапке ---
    const header = widget.querySelector('.widget-header');
    const onHeaderClick = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      switch (action) {
        case 'minimize':   this.minimize(); break;
        case 'close':      this.close(); break;
        case 'move-left':  this.onMoveRequest?.(this.id, -1); break;
        case 'move-right': this.onMoveRequest?.(this.id, 1); break;
      }
    };
    header.addEventListener('click', onHeaderClick);
    this._cleanups.push(() => header.removeEventListener('click', onHeaderClick));

    // --- Драг-н-дроп за иконку ⠿ ---
    this._setupDrag(widget);

    this.element = widget;
    return widget;
  }

  /**
   * Настраивает перетаскивание за иконку ⠿.
   * @param {HTMLElement} widget
   * @private
   */
  _setupDrag(widget) {
    const handle = widget.querySelector('.widget-btn-drag');
    if (!handle) return;

    // Включаем draggable только когда зажали за ручку
    const onHandleMouseDown = () => { widget.draggable = true; };
    const onHandleMouseUp   = () => { widget.draggable = false; };

    // HTML5 drag-n-drop
    const onDragStart = (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.id);
      widget.classList.add('widget--dragging');
    };
    const onDragEnd = () => {
      widget.classList.remove('widget--dragging');
      widget.draggable = false;
      // Убираем подсветку у всех
      document.querySelectorAll('.widget--drag-over')
        .forEach((el) => el.classList.remove('widget--drag-over'));
    };
    const onDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      widget.classList.add('widget--drag-over');
    };
    const onDragLeave = () => {
      widget.classList.remove('widget--drag-over');
    };
    const onDrop = (e) => {
      e.preventDefault();
      widget.classList.remove('widget--drag-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId || draggedId === this.id) return;
      this.onDropRequest?.(draggedId, this.id);
    };

    handle.addEventListener('mousedown', onHandleMouseDown);
    document.addEventListener('mouseup', onHandleMouseUp);
    widget.addEventListener('dragstart', onDragStart);
    widget.addEventListener('dragend', onDragEnd);
    widget.addEventListener('dragover', onDragOver);
    widget.addEventListener('dragleave', onDragLeave);
    widget.addEventListener('drop', onDrop);

    this._cleanups.push(() => {
      handle.removeEventListener('mousedown', onHandleMouseDown);
      document.removeEventListener('mouseup', onHandleMouseUp);
      widget.removeEventListener('dragstart', onDragStart);
      widget.removeEventListener('dragend', onDragEnd);
      widget.removeEventListener('dragover', onDragOver);
      widget.removeEventListener('dragleave', onDragLeave);
      widget.removeEventListener('drop', onDrop);
    });
  }

  /**
   * Возвращает .widget-body — сюда наследники кладут своё содержимое.
   */
  _getBody() {
    return this.element.querySelector('.widget-body');
  }

  /** Сворачивает/разворачивает виджет */
  minimize() {
    this._isMinimized = !this._isMinimized;
    this.element.classList.toggle('widget--minimized', this._isMinimized);
    const btn = this.element.querySelector('[data-action="minimize"]');
    if (btn) btn.textContent = this._isMinimized ? '+' : '–';
  }

  /** Просит Dashboard удалить этот виджет */
  close() {
    if (typeof this.onCloseRequest === 'function') {this.onCloseRequest(this.id);
    }
  }

  /**
   * Корректно удаляет виджет: отменяет запросы, чистит слушатели, удаляет DOM.
   */
  destroy() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this._cleanups.forEach((fn) => fn());
    this._cleanups = [];
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}
