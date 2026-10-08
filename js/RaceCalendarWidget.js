// js/RaceCalendarWidget.js
import { UIComponent } from './UIComponent.js';

/**
 * Виджет «Расписание сезона» — список гонок.
 * При клике на гонку раскрывается карточка с тематическим фото и деталями.
 */
export class RaceCalendarWidget extends UIComponent {
  constructor(config) {
    super(config);
    /** @type {Array<Object>} */
    this.races = [];
    /** @type {string|null} ID раскрытой гонки */
    this._expandedId = null;
    /** @type {AbortController|null} */
    this._loadController = null;
  }

  /** @override */
  render() {
    const shell = this._createShell();
    const body = this._getBody();

    body.innerHTML = `
      <div class="calendar-status" role="status" aria-live="polite">Загружаем календарь…</div>
      <ul class="calendar-list" hidden></ul>
    `;

    // Делегирование кликов по списку
    const listEl = body.querySelector('.calendar-list');
    const onListClick = (e) => {
      const item = e.target.closest('.calendar-item');
      if (!item) return;
      this.toggleRace(item.dataset.raceId);
    };
    listEl.addEventListener('click', onListClick);
    this._cleanups.push(() => listEl.removeEventListener('click', onListClick));

    // Кнопки внутри раскрытой карточки (делегирование на весь body)
    const onBodyClick = (e) => {
      const btn = e.target.closest('button[data-calendar-action]');
      if (!btn) return;
      const action = btn.dataset.calendarAction;
      const raceId = btn.dataset.raceId;
      if (action === 'open-track') {
        // Событие для других виджетов (опционально)
        this.element.dispatchEvent(
          new CustomEvent('race:select', { bubbles: true, detail: { raceId } })
        );
      }
    };
    body.addEventListener('click', onBodyClick);
    this._cleanups.push(() => body.removeEventListener('click', onBodyClick));

    this.loadRaces();
    return shell;
  }

  /** Загружает список гонок из локального JSON. */
  async loadRaces() {
    this._loadController?.abort();
    this._loadController = new AbortController();

    try {
      const res = await fetch('data/races.json', { signal: this._loadController.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        this._setStatus('empty', 'Календарь пуст.');
        return;
      }

      this.races = data;
      this._renderList();
      this._setStatus('success', '');
    } catch (err) {
      if (err.name === 'AbortError') return;
      this._setStatus('error', 'Не удалось загрузить календарь.');
    }
  }

  /** Раскрывает/сворачивает карточку гонки. */
  toggleRace(raceId) {
    this._expandedId = this._expandedId === raceId ? null : raceId;
    this._renderList();
  }

  /** Обновляет статус. */
  _setStatus(state, message) {
    if (!this.element) return;
    const el = this.element.querySelector('.calendar-status');
    const list = this.element.querySelector('.calendar-list');
    el.textContent = message;
    el.className = `calendar-status calendar-status--${state}`;
    el.hidden = state === 'success';
    if (list) list.hidden = state !== 'success';
  }

  /** Форматирует дату в «8 мар 2026». */
  _formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** Рисует список гонок. */
  _renderList() {
    const listEl = this.element.querySelector('.calendar-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const race of this.races) {
      const li = document.createElement('li');
      li.className = 'calendar-item';
      li.dataset.raceId = race.id;
      //const now = new Date();
        //const raceDate = new Date(race.date);
        //if (!this._nextRaceMarked && raceDate >= now) {
            //li.classList.add('calendar-item--next');
            //this._nextRaceMarked = true;
        //}
      if (this._expandedId === race.id) li.classList.add('calendar-item--expanded');

      // --- Заголовок (всегда виден) ---
      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'calendar-header';
      header.setAttribute('aria-expanded', String(this._expandedId === race.id));

      const track = document.createElement('img');
      track.className = 'calendar-track';
      track.alt = '';
      track.loading = 'lazy';
      track.src = `assets/tracks/${race.id}.jpg`;
      track.addEventListener('error', () => {
        track.src = 'assets/placeholders/track.jpg';
      }, { once: true });

      const info = document.createElement('div');
      info.className = 'calendar-info';

      const name = document.createElement('span');
      name.className = 'calendar-name';
      name.textContent = race.name;

      const meta = document.createElement('span');
      meta.className = 'calendar-meta';
      meta.textContent = `${this._formatDate(race.date)} · ${race.country}`;

      info.append(name, meta);
      header.append(track, info);

      li.appendChild(header);

      // --- Раскрытая часть ---
      if (this._expandedId === race.id) {
        const details = document.createElement('div');
        details.className = 'calendar-details';

        const theme = document.createElement('img');
        theme.className = 'calendar-theme';
        theme.alt = `${race.name} — атмосфера`;
        theme.loading = 'lazy';
        theme.src = `assets/themes/${race.id}.jpg`;
        theme.addEventListener('error', () => {
          theme.src = 'assets/placeholders/theme.jpg';
        }, { once: true });

        const circuit = document.createElement('p');
        circuit.className = 'calendar-circuit';
        circuit.textContent = `Трасса: ${race.circuit}`;

        details.append(theme, circuit);
        li.appendChild(details);
      }

      fragment.appendChild(li);
    }

    listEl.appendChild(fragment);
  }
}