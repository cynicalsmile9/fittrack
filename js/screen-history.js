/* ============================================================
   Экран «История»: все записи с группировкой по датам.
   Редактирование, удаление, копирование, просмотр деталей.
   ============================================================ */
(function () {
  'use strict';
  var U = App.U, esc = U.esc, fmt = U.fmt;

  var FILTERS = [
    { id: 'all', name: 'Всё' },
    { id: 'workout', name: 'Тренировки' },
    { id: 'food', name: 'Питание' },
    { id: 'measure', name: 'Замеры' },
    { id: 'cardio', name: 'Кардио' },
    { id: 'steps', name: 'Шаги' },
    { id: 'weight', name: 'Вес' },
    { id: 'photo', name: 'Фото' }
  ];

  App.screens.history = function () {
    var f = App.state.histFilter || 'all';
    var entries = [];

    /* тренировки */
    DB.sessionsDone().forEach(function (s) {
      entries.push({
        type: 'workout', date: s.date, icon: '🏋️',
        t: s.template_name,
        s: DB.setsOfSession(s.id).length + ' подходов · объём ' + U.fmt(DB.sessionVolume(s.id), 0) + ' кг',
        act: 'openSession', arg: s.id
      });
    });

    /* питание — по дням */
    var foodDays = {};
    DB.list('meals').forEach(function (m) { foodDays[m.date] = true; });
    Object.keys(foodDays).forEach(function (d) {
      var n = DB.dayNutrition(d);
      if (!n.itemCount) return;
      entries.push({
        type: 'food', date: d, icon: '🍽',
        t: 'Питание — ' + n.totals.kcal + ' ккал',
        s: n.itemCount + ' поз. · Б' + Math.round(n.totals.p) + ' Ж' + Math.round(n.totals.f) + ' У' + Math.round(n.totals.c),
        act: 'openDayFood', arg: d
      });
    });

    /* замеры */
    DB.list('body_measurements').forEach(function (m) {
      var parts = [];
      if (m.waist_cm != null) parts.push('талия ' + fmt(m.waist_cm));
      if (m.chest_cm != null) parts.push('грудь ' + fmt(m.chest_cm));
      if (m.arm_cm != null) parts.push('бицепс ' + fmt(m.arm_cm));
      if (m.hip_cm != null) parts.push('бёдра ' + fmt(m.hip_cm));
      if (m.neck_cm != null) parts.push('шея ' + fmt(m.neck_cm));
      entries.push({
        type: 'measure', date: m.date, icon: '📏',
        t: 'Замер', s: parts.join(' · ') || '—',
        act: 'editMeasure', arg: m.id
      });
    });

    /* кардио */
    DB.list('cardio_sessions').forEach(function (c) {
      var bits = [];
      if (c.duration_min) bits.push(c.duration_min + ' мин');
      if (c.distance_km) bits.push(fmt(c.distance_km) + ' км');
      if (c.kcal) bits.push(c.kcal + ' ккал');
      entries.push({ type: 'cardio', date: c.date, icon: '🏃', t: c.type, s: bits.join(' · ') || '—', act: 'editCardio', arg: c.id });
    });

    /* шаги */
    DB.list('daily_activity').forEach(function (a) {
      if (!a.steps) return;
      entries.push({
        type: 'steps', date: a.date, icon: '👟', t: U.fmt(a.steps, 0) + ' шагов',
        s: 'цель ' + U.fmt((DB.get('goals', 'main') || {}).steps || 8000, 0),
        act: 'editSteps', arg: a.date
      });
    });

    /* вес */
    DB.list('daily_checkins').forEach(function (c) {
      entries.push({
        type: 'weight', date: c.date, icon: '⚖️', t: fmt(c.weight_kg) + ' кг',
        s: c.note || 'взвешивание', act: 'editWeight', arg: c.date
      });
    });

    /* фото */
    DB.list('progress_photos').forEach(function (p) {
      entries.push({ type: 'photo', date: p.date, icon: '📷', t: 'Фото', s: 'нажмите, чтобы открыть', act: 'viewPhotoRec', arg: p.id });
    });

    entries.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    if (f !== 'all') entries = entries.filter(function (e) { return e.type === f; });

    var html = '<div class="chips">' + FILTERS.map(function (x) {
      return '<button class="chip ' + (x.id === f ? 'on' : '') + '" data-action="histFilter" data-f="' + x.id + '">' + x.name + '</button>';
    }).join('') + '</div>';

    if (!entries.length) {
      html += '<div class="empty">Записей пока нет.<br>Добавьте вес, еду или тренировку на главном экране.</div>';
    } else {
      var curDate = null;
      entries.slice(0, 300).forEach(function (e) {
        if (e.date !== curDate) {
          curDate = e.date;
          html += '<div class="dategroup">' + U.dateRu(e.date) + '</div>';
        }
        html += '<div class="lrow" data-action="' + e.act + '" data-arg="' + e.arg + '">' +
          '<div class="ico">' + e.icon + '</div><div class="grow"><div class="t">' + esc(e.t) + '</div>' +
          '<div class="s">' + esc(e.s) + '</div></div><span class="chev">›</span></div>';
      });
    }

    U.$('#screen').innerHTML = html;
  };

  App.actions.histFilter = function (d) { App.state.histFilter = d.f; App.render(); };
  App.actions.openDayFood = function (d) { App.push(App.views.dayFood(d.arg)); };
  /* openSession определён в screen-workout.js (читает data-sid) */
  App.actions.editMeasure = function (d) {
    var m = DB.get('body_measurements', d.arg); if (m) App.modals.measure(m);
  };
  App.actions.editCardio = function (d) {
    var c = DB.get('cardio_sessions', d.arg); if (c) App.modals.cardio(c);
  };
  App.actions.editSteps = function (d) { App.modals.steps(d.arg); };
  App.actions.editWeight = function (d) { App.modals.checkin(d.arg); };
})();
