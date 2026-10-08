// js/NextRaceWidget.js
import { UIComponent } from './UIComponent.js';

const API_URL = 'https://api.jolpi.ca/ergast/f1/2026/next.json';
const FALLBACK_URL = 'data/next-race-fallback.json';

/**
 * Виджет «Следующая гонка» — обратный отсчёт до ближайшего этапа.
 * Данные из Jolpica F1 API, при ошибке — из локального JSON.
 */
export class NextRaceWidget extends UIComponent {
  constructor(config) {
    super(config);
    /** @type {Object|null} */
    this.race = null;
    /** @type {number|null} */
    this._intervalId = null;
  }

  /** @override */
  render() {
    const shell = this._createShell();
    const body = this._getBody();

    body.innerHTML = `
      <div class="nextrace-status" role="status" aria-live="polite">Загружаем данные…</div>
      <div class="nextrace-content" hidden></div>
    `;

    this.loadData();
    return shell;
  }

  /** Загружает данные о следующей гонке. */
  async loadData() {
    this.abortController?.abort();
    this.abortController = new AbortController();

    try {
      const data = await this._fetchJson(API_URL, this.abortController.signal);
      const race = this._parseApiResponse(data);

      if (!race) {
        this._setStatus('empty', 'Сезон завершён или ещё не начался.');
        return;
      }

      this.race = race;
      this._renderContent();
      this._setStatus('success', '');
      this._startTimer();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Next Race API недоступен, пробуем fallback:', err.message);

      try {
        const fallback = await this._fetchJson(FALLBACK_URL, this.abortController.signal);
        this.race = {
          name: fallback.name,
          country: fallback.country,
          circuit: fallback.circuit,
          date: fallback.date,
          time: fallback.time,
          id: fallback.id,
        };
        this._renderContent();
        this._setStatus('success', '');
        this._startTimer();
      } catch (fallbackErr) {
        if (fallbackErr.name === 'AbortError') return;
        this._setStatus('error', 'Не удалось загрузить данные.');
      }
    }
  }

  /** @private */
  async _fetchJson(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /** Парсит ответ Jolpica API. */
  _parseApiResponse(data) {
    const race = data?.MRData?.RaceTable?.Races?.[0];
    if (!race) return null;

    return {
      id: race.round ? `round-${race.round}` : '',
      name: race.raceName,
      country: race.Circuit?.Location?.country || '—',
      circuit: race.Circuit?.circuitName || '—',
      date: race.date,
      time: race.time || '00:00:00Z',
    };
  }

  /** Запускает таймер обновления отсчёта. */
  _startTimer() {
    this._stopTimer();
    this._intervalId = setInterval(() => this._updateCountdown(), 1000);
    // Сохраняем в cleanup, чтобы destroy() остановил
    this._cleanups.push(() => this._stopTimer());
    this._updateCountdown();
  }

  /** @private */
  _stopTimer() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /** Обновляет цифры обратного отсчёта. */
  _updateCountdown() {
    if (!this.element || !this.race) return;

    const target = new Date(`${this.race.date}T${this.race.time}`);
    if (Number.isNaN(target.getTime())) return;

    const diff = target - Date.now();
    const countdown = this.element.querySelector('.nextrace-countdown');
    if (!countdown) return;

    if (diff <= 0) {
      countdown.innerHTML = '';
      const live = document.createElement('div');
      live.className = 'nextrace-live';
      live.textContent = '🏁 ГОНКА УЖЕ ИДЁТ ИЛИ ЗАВЕРШЕНА';
      countdown.appendChild(live);
      this._stopTimer();
      return;
    }

    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const setValue = (selector, value) => {
      const el = countdown.querySelector(selector);
      if (el) el.textContent = String(value).padStart(2, '0');
    };
    setValue('[data-unit="days"]', days);
    setValue('[data-unit="hours"]', hours);
    setValue('[data-unit="minutes"]', minutes);
    setValue('[data-unit="seconds"]', seconds);
  }

  /** Рендерит контент: hero + таймер. */
  _renderContent() {
    const content = this.element.querySelector('.nextrace-content');
    if (!content || !this.race) return;

    content.innerHTML = '';
    content.hidden = false;

    // Hero с тематической картинкой
    const hero = document.createElement('div');
    hero.className = 'nextrace-hero';

    const img = document.createElement('img');
    img.className = 'nextrace-hero__img';
    img.alt = `${this.race.name} — атмосфера`;
    img.loading = 'lazy';
    // Пробуем тему по id, если id — round-N, то не сработает, ставим заглушку
    img.src = `assets/themes/${this._themeId()}.jpg`;
    img.addEventListener('error', () => {
      img.src = 'assets/placeholders/theme.jpg';
    }, { once: true });

    const overlay = document.createElement('div');
    overlay.className = 'nextrace-hero__overlay';

    const label = document.createElement('span');
    label.className = 'nextrace-label';
    label.textContent = 'СЛЕДУЮЩАЯ ГОНКА';

    const title = document.createElement('h3');
    title.className = 'nextrace-title';
    title.textContent = this.race.name;

    const meta = document.createElement('p');
    meta.className = 'nextrace-meta';
    meta.textContent = `${this.race.circuit} · ${this.race.country}`;

    overlay.append(label, title, meta);
    hero.append(img, overlay);

    // Таймер
    const countdown = document.createElement('div');
    countdown.className = 'nextrace-countdown';

    const units = [
      ['days', 'ДНЕЙ'],
      ['hours', 'ЧАСОВ'],
      ['minutes', 'МИНУТ'],
      ['seconds', 'СЕКУНД'],
    ];

    for (const [unit, labelText] of units) {
      const box = document.createElement('div');
      box.className = 'nextrace-unit';

      const value = document.createElement('span');
      value.className = 'nextrace-value';
      value.dataset.unit = unit;
      value.textContent = '00';

      const lbl = document.createElement('span');
      lbl.className = 'nextrace-unit-label';
      lbl.textContent = labelText;

      box.append(value, lbl);
      countdown.appendChild(box);
    }

    content.append(hero, countdown);
  }

  /**
   * Пытается сопоставить название гонки с id в assets/themes/.
   * Если не получается — вернёт пустую строку и сработает заглушка.
   */
  _themeId() {
    if (!this.race || !this.race.name) return '';
    const name = this.race.name.toLowerCase();
    const map = {
      'australian': 'australia',
      'chinese': 'china',
      'japanese': 'japan',
      'miami': 'miami',
      'canadian': 'canada',
      'monaco': 'monaco',
      'spanish': 'barcelona-catalunya',
      'austrian': 'austria',
      'british': 'great-britain',
      'belgian': 'belgium',
      'hungarian': 'hungary',
      'dutch': 'netherlands',
      'italian': 'italy',
      'madrid': 'spain',
      'azerbaijan': 'azerbaijan',
      'bahrain': 'bahrain',
      'singapore': 'singapore',
      'united states': 'united-states',
      'mexico': 'mexico',
      'são paulo': 'brazil',
      'sao paulo': 'brazil',
      'las vegas': 'las-vegas',
      'qatar': 'qatar',
      'abu dhabi': 'united-arab-emirates',
    };
    for (const [key, id] of Object.entries(map)) {
      if (name.includes(key)) return id;
    }
    return '';
  }

  /** Обновляет статус. */
  _setStatus(state, message) {
    if (!this.element) return;
    const el = this.element.querySelector('.nextrace-status');
    const content = this.element.querySelector('.nextrace-content');
    el.textContent = message;
    el.className = `nextrace-status nextrace-status--${state}`;
    el.hidden = state === 'success';
    if (content && state !== 'success') content.hidden = true;
  }

  /** @override — доп. очистка таймера. */
  destroy() {
    this._stopTimer();
    super.destroy();
  }
}