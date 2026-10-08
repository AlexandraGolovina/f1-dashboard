// js/ToDoWidget.js
import { UIComponent } from './UIComponent.js';

/**
 * Виджет «Мои гонки» — список дел в стиле ToDo.
 * Позволяет добавлять, отмечать выполненные и удалять задачи.
 * Состояние хранится внутри класса (инкапсуляция).
 */
export class ToDoWidget extends UIComponent {
  /**
   * @param {Object} config
   * @param {string} config.id
   * @param {string} config.title
   */
  constructor(config) {
    super(config);

    /** @type {Array<{id: number, text: string, done: boolean}>} */
    this.tasks = [];

    /** @type {number} */
    this._taskCounter = 0;

    /** @type {HTMLElement|null} */
    this._listEl = null;
    /** @type {HTMLInputElement|null} */
    this._inputEl = null;
  }

  /**
   * @override
   * @returns {HTMLElement}
   */
  render() {
    const shell = this._createShell();
    const body = this._getBody();

    body.innerHTML = `
      <form class="todo-form" novalidate>
        <input
          type="text"
          class="todo-input"
          placeholder="Например: посмотреть Гран-при Монако"
          maxlength="120"
          aria-label="Новая задача"
        />
        <button type="submit" class="btn btn-primary todo-add">Добавить</button>
      </form>
      <ul class="todo-list" aria-live="polite"></ul>
      <p class="todo-empty">Пока пусто. Добавь первую гонку в список!</p>
    `;

    this._inputEl = body.querySelector('.todo-input');
    this._listEl = body.querySelector('.todo-list');

    // Делегирование submit на форме
    const form = body.querySelector('.todo-form');
    const onSubmit = (e) => {
      e.preventDefault();
      this.addTask(this._inputEl.value);
    };
    form.addEventListener('submit', onSubmit);
    this._cleanups.push(() => form.removeEventListener('submit', onSubmit));

    // Делегирование кликов по списку
    const onListClick = (e) => {
      const btn = e.target.closest('button[data-task-action]');
      if (!btn) return;
      const taskId = Number(btn.dataset.taskId);
      const action = btn.dataset.taskAction;
      if (action === 'toggle') this.toggleTask(taskId);
      if (action === 'remove') this.removeTask(taskId);
    };
    this._listEl.addEventListener('click', onListClick);
    this._cleanups.push(() => this._listEl.removeEventListener('click', onListClick));

    this._renderList();
    return shell;
  }

  /**
   * Добавляет задачу.
   * @param {string} text
   */
  addTask(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;

    this.tasks.push({
      id: ++this._taskCounter,
      text: trimmed,
      done: false,
    });

    if (this._inputEl) this._inputEl.value = '';
    this._renderList();
  }

  /**
   * Переключает статус задачи.
   * @param {number} taskId
   */
  toggleTask(taskId) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.done = !task.done;
    this._renderList();
  }

  /**
   * Удаляет задачу.
   * @param {number} taskId
   */
  removeTask(taskId) {
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    this._renderList();
  }

  /**
   * Перерисовывает список задач.
   * @private
   */
  _renderList() {
    if (!this._listEl) return;

    const emptyEl = this.element.querySelector('.todo-empty');

    if (this.tasks.length === 0) {
      this._listEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    // Безопасная вставка: используем textContent, а не innerHTML для текста задачи
    this._listEl.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const task of this.tasks) {
      const li = document.createElement('li');
      li.className = 'todo-item' + (task.done ? ' todo-item--done' : '');
      li.dataset.taskId = String(task.id);

      const checkbox = document.createElement('button');
      checkbox.type = 'button';
      checkbox.className = 'todo-check';
      checkbox.dataset.taskAction = 'toggle';
      checkbox.dataset.taskId = String(task.id);
      checkbox.setAttribute('aria-pressed', String(task.done));
      checkbox.setAttribute('aria-label', task.done ? 'Снять отметку' : 'Отметить выполненной');
      checkbox.textContent = task.done ? '✓' : '';

      const span = document.createElement('span');
      span.className = 'todo-text';
      span.textContent = task.text; // ← защита от XSS

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'todo-remove';
      removeBtn.dataset.taskAction = 'remove';
      removeBtn.dataset.taskId = String(task.id);
      removeBtn.setAttribute('aria-label', 'Удалить задачу');
      removeBtn.textContent = '×';

      li.append(checkbox, span, removeBtn);
      fragment.appendChild(li);
    }

    this._listEl.appendChild(fragment);
  }
}