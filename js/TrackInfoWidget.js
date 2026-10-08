// js/TrackInfoWidget.js
import { UIComponent } from './UIComponent.js';

/**
 * Виджет «Информация о трассе» — детальная карточка выбранной гонки.
 * Слушает событие race:select от календаря, чтобы переключать трассу.
 */
export class TrackInfoWidget extends UIComponent {
  constructor(config) {
    super(config);
    /** @type {Array<Object>} */
    this.races = [];
    /** @type {Object} */
    this.trackInfo = {};
    /** @type {string|null} */
    this._selectedId = null;
    /** @type {AbortController|null} */
    this._loadController = null;
  }

  /** @override */
  render() {
    const shell = this._createShell();
    const body = this._getBody();

    body.innerHTML = `
      <div class="track-select-wrapper">
        <label for="${this.id}-select" class="track-select-label">Гран-при:</label>
        <select id="${this.id}-select" class="track-select" aria-label="Выбор Гран-при"></select>
      </div>
      <div class="track-status" role="status" aria-live="polite">Загружаем…</div>
      <div class="track-content" hidden></div>
    `;

    const select = body.querySelector('.track-select');
    const onChange = (e) => this.selectRace(e.target.value);
    select.addEventListener('change', onChange);
    this._cleanups.push(() => select.removeEventListener('change', onChange));

    // Слушаем событие от календаря — если пользователь кликнул на гонку там
    const onRaceSelect = (e) => {
      if (e.detail?.raceId) this.selectRace(e.detail.raceId);
    };
    document.addEventListener('race:select', onRaceSelect);
    this._cleanups.push(() => document.removeEventListener('race:select', onRaceSelect));

    this.loadData();
    return shell;
  }

  /** Загружает справочники гонок и трасс. */
  async loadData() {
    this._loadController?.abort();
    this._loadController = new AbortController();

    try {
      const [racesRes, infoRes] = await Promise.all([
        fetch('data/races.json', { signal: this._loadController.signal }),
        fetch('data/tracks-info.json', { signal: this._loadController.signal }),
      ]);

      if (!racesRes.ok || !infoRes.ok) throw new Error('HTTP error');

      this.races = await racesRes.json();
      this.trackInfo = await infoRes.json();

      if (!Array.isArray(this.races) || this.races.length === 0) {
        this._setStatus('empty', 'Нет данных о трассах.');
        return;
      }

      // Заполняем select
      const select = this.element.querySelector('.track-select');
      select.innerHTML = '';
      for (const race of this.races) {
        const opt = document.createElement('option');
        opt.value = race.id;
        opt.textContent = race.name;
        select.appendChild(opt);
      }

      // Выбираем первую по умолчанию
      this.selectRace(this.races[0].id);
    } catch (err) {
      if (err.name === 'AbortError') return;
      this._setStatus('error', 'Не удалось загрузить данные.');
    }
  }

  /** Переключает отображаемую трассу. */
  selectRace(raceId) {
    const race = this.races.find((r) => r.id === raceId);
    if (!race) return;

    this._selectedId = raceId;

    // Синхронизируем select, если переключение пришло извне
    const select = this.element.querySelector('.track-select');
    if (select && select.value !== raceId) select.value = raceId;

    this._setStatus('success', '');
    this._renderContent(race);
  }

    /** Рендерит карточку трассы. */
  _renderContent(race) {
    const content = this.element.querySelector('.track-content');
    if (!content) return;

    content.innerHTML = '';
    content.hidden = false;

    // --- HERO с тематической картинкой ---
    const hero = document.createElement('div');
    hero.className = 'track-hero';

    const heroImg = document.createElement('img');
    heroImg.className = 'track-hero__img';
    heroImg.alt = `${race.name} — атмосфера`;
    heroImg.loading = 'lazy';
    heroImg.src = `assets/themes/${race.id}.jpg`;
    heroImg.addEventListener('error', () => {
      heroImg.src = 'assets/placeholders/theme.jpg';
    }, { once: true });

    const overlay = document.createElement('div');
    overlay.className = 'track-hero__overlay';

    const heroTitle = document.createElement('h3');
    heroTitle.className = 'track-hero__title';
    heroTitle.textContent = race.name;

    const heroSub = document.createElement('p');
    heroSub.className = 'track-hero__subtitle';
    heroSub.textContent = `${this._formatDate(race.date)} · ${race.country}`;

    overlay.append(heroTitle, heroSub);
    hero.append(heroImg, overlay);

    // --- Нижняя часть: карта + статистика ---
    const bodyGrid = document.createElement('div');
    bodyGrid.className = 'track-body';

    // Карта
    const mapWrap = document.createElement('div');
    mapWrap.className = 'track-map-wrapper';

    const map = document.createElement('img');
    map.className = 'track-map';
    map.alt = `Карта трассы ${race.circuit}`;
    map.loading = 'lazy';
    map.src = `assets/tracks/${race.id}.jpg`;
    map.addEventListener('error', () => {
      map.src = 'assets/placeholders/track.jpg';
    }, { once: true });

    mapWrap.appendChild(map);

    // Статистика
    const statsWrap = document.createElement('div');
    statsWrap.className = 'track-stats-wrapper';

    const info = this.trackInfo[race.id] || {};
    const stats = document.createElement('dl');
    stats.className = 'track-stats';

    const rows = [
      ['Трасса', race.circuit],
      ['Страна', race.country],
      ['Дата', this._formatDate(race.date)],
      ['Длина', info.length || '—'],
      ['Повороты', info.corners ?? '—'],
      ['Кругов', info.laps ?? '—'],
      ['Рекорд круга', info.lapRecord || '—'],
    ];

    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = String(value);
      stats.append(dt, dd);
    }

    statsWrap.appendChild(stats);
    bodyGrid.append(mapWrap, statsWrap);
    content.append(hero, bodyGrid);
  }
  /** Форматирует ISO-дату. */
  _formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** Обновляет статус. */
  _setStatus(state, message) {
    if (!this.element) return;
    const el = this.element.querySelector('.track-status');
    const content = this.element.querySelector('.track-content');
    el.textContent = message;
    el.className = `track-status track-status--${state}`;
    el.hidden = state === 'success';
    if (content && state !== 'success') content.hidden = true;
  }
}