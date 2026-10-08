// js/StandingsWidget.js
import { UIComponent } from './UIComponent.js';

const API_URL = 'https://api.jolpi.ca/ergast/f1/2026/driverStandings.json';
const FALLBACK_URL = 'data/standings-fallback.json';

/**
 * Виджет «Положение пилотов» — топ-10 из чемпионата.
 * Данные берутся из Jolpica F1 API, при ошибке — из локального JSON.
 */
export class StandingsWidget extends UIComponent {
  static DRIVER_ALIAS = {
  max_verstappen: 'verstappen',
  arvid_lindblad: 'lindblad',
};

  constructor(config) {
    super(config);
    this.standings = [];
  }


  /** @override */
  render() {
    const shell = this._createShell();
    const body = this._getBody();

    body.innerHTML = `
      <div class="standings-status" role="status" aria-live="polite"></div>
      <ul class="standings-list" hidden></ul>
      <button type="button" class="btn standings-refresh">Обновить</button>
    `;

    const refreshBtn = body.querySelector('.standings-refresh');
    const onRefresh = () => this.loadData();
    refreshBtn.addEventListener('click', onRefresh);
    this._cleanups.push(() => refreshBtn.removeEventListener('click', onRefresh));

    // Загружаем сразу после рендера
    this.loadData();

    return shell;
  }

  /**
   * Загружает данные: сначала пробует API, при ошибке — fallback.
   */
  async loadData() {
    this._setStatus('loading', 'Загружаем данные…');

    // Отменяем предыдущий запрос, если он ещё в полёте
    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();

    try {
      const data = await this._fetchJson(API_URL, this.abortController.signal);
      const list = this._parseApiResponse(data);

      if (list.length === 0) {
        this._setStatus('empty', 'Данных пока нет — сезон не начался.');
        return;
      }

      this.standings = list;
      this._renderList();
      this._setStatus('success', '');
    } catch (err) {
      if (err.name === 'AbortError') return; // отмена — не ошибка
      console.warn('Standings API недоступен, пробуем fallback:', err.message);

      // Пробуем локальный JSON
      try {
        const fallback = await this._fetchJson(FALLBACK_URL, this.abortController.signal);
        this.standings = this._parseFallback(fallback);
        this._renderList();
        this._setStatus('success', '');
      } catch (fallbackErr) {
        if (fallbackErr.name === 'AbortError') return;
        this._setStatus('error', 'Не удалось загрузить данные. Попробуйте позже.');
      }
    }
  }

  /**
   * Безопасный fetch JSON.
   * @param {string} url
   * @param {AbortSignal} signal
   */
  async _fetchJson(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /**
   * Парсит ответ Jolpica API.
   * @param {Object} data
   * @returns {Array<{position:number,name:string,team:string,points:number,driverId:string}>}
   */
  _parseApiResponse(data) {
    const list = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
    return list.map((item) => ({
      position: Number(item.position),
      name: `${item.Driver.givenName} ${item.Driver.familyName}`,
      driverId: item.Driver.driverId.toLowerCase(),
      team: item.Constructors?.[0]?.name || '—',
      points: Number(item.points),
    }));
  }

  /** Парсит локальный fallback-JSON (простой массив). */
  _parseFallback(data) {
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      position: Number(item.position),
      name: item.name,
      driverId: String(item.driverId).toLowerCase(),
      team: item.team,
      points: Number(item.points),
    }));
  }

  /** Обновляет статус-сообщение. */
  _setStatus(state, message) {
    if (!this.element) return;
    const el = this.element.querySelector('.standings-status');
    const list = this.element.querySelector('.standings-list');
    if (!el) return;

    el.textContent = message;
    el.className = `standings-status standings-status--${state}`;
    el.hidden = state === 'success';
    if (list) list.hidden = state !== 'success';
  }
  // Внутри класса, перед _renderList или как статическое поле:
    static DRIVER_ALIAS = {
        max_verstappen: 'verstappen',
  // добавь сюда остальные расхождения, если найдутся
};
  /** Рисует список пилотов. */
  _renderList() {
    const listEl = this.element.querySelector('.standings-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const item of this.standings.slice(0, 10)) {
      const li = document.createElement('li');
      li.className = 'standings-item';

      const pos = document.createElement('span');
      pos.className = 'standings-pos';
      pos.textContent = String(item.position);

      const img = document.createElement('img');
      img.className = 'standings-photo';
      img.alt = item.name;
      img.loading = 'lazy';
      const fileId = StandingsWidget.DRIVER_ALIAS[item.driverId] || item.driverId;
img.src = `assets/drivers/${fileId}.jpg`;
      img.addEventListener(
        'error',
        () => {
          img.src = 'assets/placeholders/driver.jpg';
        },
        { once: true }
      );

      const info = document.createElement('div');
      info.className = 'standings-info';

      const name = document.createElement('span');
      name.className = 'standings-name';
      name.textContent = item.name;

      const team = document.createElement('span');
      team.className = 'standings-team';
      team.textContent = item.team;

      info.append(name, team);

      const pts = document.createElement('span');
      pts.className = 'standings-points';
      pts.textContent = `${item.points} PTS`;

      li.append(pos, img, info, pts);
      fragment.appendChild(li);
    }

    listEl.appendChild(fragment);
  }
}