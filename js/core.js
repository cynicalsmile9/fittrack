/* ============================================================
   FitTrack — ядро: утилиты, роутер, модалки, тосты, графики
   ============================================================ */
(function () {
  'use strict';

  var App = window.App = {
    screens: {},   // вкладки: dashboard/food/workout/analytics/history
    views: {},     // detail-вьюхи (push поверх вкладки)
    actions: {},   // обработчики data-action / data-change
    modals: {},    // переиспользуемые модалки
    state: { tab: 'dashboard', stack: [], analyticsEx: null, histFilter: 'all', sessionExtras: {} }
  };

  var U = App.U = {
    $: function (s, r) { return (r || document).querySelector(s); },
    $$: function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    fmt: function (n, d) {
      if (n == null || isNaN(n)) return '—';
      var v = Math.round(n * 10) / 10;
      return (d === 0) ? String(Math.round(n)) : String(v).replace('.', ',');
    },
    fmtW: function (n) { return n == null || isNaN(n) ? '—' : String(Math.round(n * 10) / 10).replace('.', ','); },
    pad: function (n) { return n < 10 ? '0' + n : '' + n; },
    dstr: function (d) { return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); },
    todayStr: function () { return U.dstr(new Date()); },
    addDays: function (str, n) {
      var p = str.split('-').map(Number);
      var d = new Date(p[0], p[1] - 1, p[2] + n);
      return U.dstr(d);
    },
    MONTHS: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    MONTHS_S: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    WDAYS: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
    dateRu: function (str) {
      if (!str) return '';
      var p = str.split('-').map(Number);
      var d = new Date(p[0], p[1] - 1, p[2]);
      var t = U.todayStr();
      if (str === t) return 'сегодня';
      if (str === U.addDays(t, -1)) return 'вчера';
      return d.getDate() + ' ' + U.MONTHS[d.getMonth()] + ', ' + U.WDAYS[d.getDay()];
    },
    dateShort: function (str) {
      if (!str) return '';
      var p = str.split('-').map(Number);
      var d = new Date(p[0], p[1] - 1, p[2]);
      return d.getDate() + ' ' + U.MONTHS_S[d.getMonth()];
    },
    num: function (v) {
      var n = parseFloat(String(v).replace(',', '.'));
      return isNaN(n) ? null : n;
    }
  };

  /* ---------- тосты ---------- */
  App.toast = function (msg, ok) {
    var root = U.$('#toast-root');
    var el = document.createElement('div');
    el.className = 'toast' + (ok ? ' ok' : '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2200);
    setTimeout(function () { el.remove(); }, 2600);
  };

  /* ---------- модалки ---------- */
  App.modal = function (opts) {
    var root = U.$('#modal-root');
    var back = document.createElement('div');
    back.className = 'backdrop';
    back.innerHTML =
      '<div class="modal" role="dialog">' +
      '<div class="modal-h"><h3>' + U.esc(opts.title || '') + '</h3>' +
      '<button class="iconbtn m-close">✕</button></div>' +
      '<div class="modal-b">' + (opts.body || '') + (opts.footer || '') + '</div></div>';
    root.appendChild(back);
    function close() { back.remove(); if (opts.onClose) opts.onClose(); }
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    U.$('.m-close', back).addEventListener('click', close);
    if (opts.onMount) opts.onMount(back, close);
    return { el: back, close: close };
  };

  App.confirm = function (o) {
    App.modal({
      title: o.title || 'Подтверждение',
      body: '<p class="muted" style="margin:4px 0 0">' + U.esc(o.message || '') + '</p>',
      footer: '<div class="btnrow"><button class="btn sec" data-x="no">Отмена</button>' +
        '<button class="btn ' + (o.danger ? 'danger' : '') + '" data-x="yes" style="' + (o.danger ? '' : '') + '">' + U.esc(o.okText || 'ОК') + '</button></div>',
      onMount: function (el, close) {
        U.$('[data-x=no]', el).onclick = close;
        U.$('[data-x=yes]', el).onclick = function () { close(); if (o.onOk) o.onOk(); };
      }
    });
  };

  /* ---------- роутер ---------- */
  var TAB_TITLES = { dashboard: 'Сегодня', food: 'Питание', workout: 'Тренировки', analytics: 'Аналитика', history: 'История' };
  App.go = function (tab) { App.state.tab = tab; App.state.stack = []; render(); };
  App.push = function (view) { App.state.stack.push(view); render(); };
  App.pop = function () { App.state.stack.pop(); render(); };
  App.render = render;

  function render() {
    var st = App.state;
    var top = st.stack[st.stack.length - 1];
    var screen = U.$('#screen');
    var title = U.$('#topbarTitle');
    var back = U.$('#backBtn');
    screen.scrollTop = 0;
    if (top) { title.textContent = top.title; back.hidden = false; top.render(); }
    else { title.textContent = TAB_TITLES[st.tab]; back.hidden = true; App.screens[st.tab](); }
    U.$$('#bottomnav button').forEach(function (b) {
      b.classList.toggle('active', !top && b.dataset.nav === st.tab);
    });
  }

  /* ---------- делегирование событий ---------- */
  function bindDelegation() {
    U.$('#screen').addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var fn = App.actions[el.dataset.action];
      if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
    });
    /* capture-фаза ловит и события без всплытия (некоторые среды ввода) */
    U.$('#screen').addEventListener('change', dispatchDataChange, true);
    U.$('#screen').addEventListener('input', dispatchDataChange, true);

    var inputTimer = null;
    function dispatchDataChange(e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-change]') : null;
      if (!el) return;
      var fn = App.actions[el.dataset.change];
      if (!fn) return;
      if (e.type === 'input') {
        /* сохраняем на лету, но с дебаунсом; change обрабатываем сразу */
        clearTimeout(inputTimer);
        inputTimer = setTimeout(function () { fn(el.dataset, el, e); }, 300);
      } else {
        clearTimeout(inputTimer);
        fn(el.dataset, el, e);
      }
    }
    U.$('#bottomnav').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-nav]');
      if (b) App.go(b.dataset.nav);
    });
    U.$('#backBtn').addEventListener('click', App.pop);
    U.$('#settingsBtn').addEventListener('click', function () {
      if (App.views.settings) {
        var v = App.views.settings();
        App.push({ title: v.title, render: v.render });
      }
    });
  }

  /* ---------- SVG-графики (без внешних библиотек) ---------- */
  U.lineChart = function (pts, opts) {
    opts = opts || {};
    var W = 340, H = 160, PL = 36, PR = 14, PT = 16, PB = 22;
    if (!pts.length) return '<div class="empty">Нет данных</div>';
    var vals = pts.map(function (p) { return p.value; });
    var vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    var span = vmax - vmin; vmin -= span * .12; vmax += span * .12;
    function X(i) { return PL + (W - PL - PR) * (pts.length === 1 ? .5 : i / (pts.length - 1)); }
    function Y(v) { return H - PB - (H - PT - PB) * (v - vmin) / (vmax - vmin); }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p.value).toFixed(1); }).join(' ');
    var area = d + ' L' + X(pts.length - 1).toFixed(1) + ',' + (H - PB) + ' L' + X(0).toFixed(1) + ',' + (H - PB) + ' Z';
    var last = pts[pts.length - 1];
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    s += '<line x1="' + PL + '" y1="' + Y(vmax + (vmax - vmin) * 0) + '" x2="' + (W - PR) + '" y2="' + Y(vmax) + '" stroke="#242e44" stroke-dasharray="3 4"/>';
    s += '<line x1="' + PL + '" y1="' + Y(vmin) + '" x2="' + (W - PR) + '" y2="' + Y(vmin) + '" stroke="#242e44" stroke-dasharray="3 4"/>';
    if (opts.goal != null && opts.goal >= vmin && opts.goal <= vmax) {
      s += '<line x1="' + PL + '" y1="' + Y(opts.goal) + '" x2="' + (W - PR) + '" y2="' + Y(opts.goal) + '" stroke="#fbbf24" stroke-dasharray="5 4" opacity=".7"/>';
    }
    s += '<path d="' + area + '" fill="rgba(74,222,128,.10)"/>';
    s += '<path d="' + d + '" fill="none" stroke="#4ade80" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';
    s += '<circle cx="' + X(pts.length - 1).toFixed(1) + '" cy="' + Y(last.value).toFixed(1) + '" r="3.6" fill="#4ade80"/>';
    s += '<text x="' + (W - PR) + '" y="' + Math.max(PT + 2, Y(last.value) - 8).toFixed(1) + '" fill="#4ade80" font-size="11" font-weight="700" text-anchor="end">' + U.fmt(last.value) + '</text>';
    s += '<text x="4" y="' + (Y(vmax) + 4).toFixed(1) + '" fill="#5b6880" font-size="10">' + U.fmt(vmax) + '</text>';
    s += '<text x="4" y="' + (Y(vmin) + 4).toFixed(1) + '" fill="#5b6880" font-size="10">' + U.fmt(vmin) + '</text>';
    s += '<text x="' + PL + '" y="' + (H - 6) + '" fill="#5b6880" font-size="10">' + U.esc(pts[0].label) + '</text>';
    s += '<text x="' + (W - PR) + '" y="' + (H - 6) + '" fill="#5b6880" font-size="10" text-anchor="end">' + U.esc(last.label) + '</text>';
    s += '</svg>';
    return s;
  };

  U.barChart = function (items, opts) {
    opts = opts || {};
    var W = 340, H = 150, PL = 34, PR = 10, PT = 12, PB = 20;
    if (!items.length) return '<div class="empty">Нет данных</div>';
    var vmax = Math.max.apply(null, items.map(function (i) { return i.value; }).concat(opts.goal != null ? [opts.goal] : [0])) || 1;
    vmax *= 1.15;
    function Y(v) { return H - PB - (H - PT - PB) * (v / vmax); }
    var iw = (W - PL - PR) / items.length;
    var bw = Math.max(4, iw * .62);
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    items.forEach(function (it, i) {
      var x = PL + iw * i + (iw - bw) / 2;
      var y = Y(it.value);
      var over = opts.goal != null && it.value > opts.goal;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, (H - PB - y)).toFixed(1) + '" rx="2.5" fill="' + (over ? '#f87171' : '#38bdf8') + '" opacity="' + (it.value ? '.95' : '.25') + '"/>';
    });
    if (opts.goal != null) {
      s += '<line x1="' + PL + '" y1="' + Y(opts.goal).toFixed(1) + '" x2="' + (W - PR) + '" y2="' + Y(opts.goal).toFixed(1) + '" stroke="#fbbf24" stroke-dasharray="5 4"/>';
      s += '<text x="' + (W - PR) + '" y="' + (Y(opts.goal) - 4).toFixed(1) + '" fill="#fbbf24" font-size="9.5" text-anchor="end">цель ' + U.fmt(opts.goal, 0) + '</text>';
    }
    s += '<text x="' + PL + '" y="' + (H - 6) + '" fill="#5b6880" font-size="10">' + U.esc(items[0].label) + '</text>';
    s += '<text x="' + (W - PR) + '" y="' + (H - 6) + '" fill="#5b6880" font-size="10" text-anchor="end">' + U.esc(items[items.length - 1].label) + '</text>';
    s += '</svg>';
    return s;
  };

  /* ---------- сжатие фото ---------- */
  U.resizeImage = function (file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, maxDim / Math.max(img.width, img.height));
        var w = Math.round(img.width * k), h = Math.round(img.height * k);
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/jpeg', quality || .72));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать изображение')); };
      img.src = url;
    });
  };

  App.MEAL_TYPES = [
    { id: 'breakfast', name: 'Завтрак', icon: '🌅' },
    { id: 'lunch', name: 'Обед', icon: '☀️' },
    { id: 'dinner', name: 'Ужин', icon: '🌙' },
    { id: 'snack', name: 'Перекус', icon: '🥜' }
  ];

  App.init = function () {
    DB.seed();
    bindDelegation();
    App.go('dashboard');
  };
})();
