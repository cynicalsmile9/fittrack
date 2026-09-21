/* ============================================================
   Экран «Сегодня» + быстрые действия: вес, кардио, шаги,
   замер, фото. Каждое действие — 1–2 тапа.
   ============================================================ */
(function () {
  'use strict';
  var U = App.U, esc = U.esc, fmt = U.fmt;

  function checkinsSorted() {
    return DB.list('daily_checkins').slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  /* ================= ВЕС ================= */
  App.modals.checkin = function (date) {
    var d = date || U.todayStr();
    var rec = DB.getWhere('daily_checkins', function (r) { return r.date === d; });
    App.modal({
      title: 'Вес — ' + U.dateRu(d),
      body:
        '<label class="f"><span class="lb">Вес, кг</span>' +
        '<input type="number" inputmode="decimal" step="0.1" id="ck-w" value="' + (rec ? rec.weight_kg : '') + '" placeholder="напр. 78,5" autofocus></label>' +
        '<label class="f"><span class="lb">Заметка (необязательно)</span>' +
        '<input type="text" id="ck-n" value="' + esc(rec && rec.note ? rec.note : '') + '" placeholder="натощак, после сна…"></label>' +
        (rec ? '<button class="btn danger" id="ck-del" style="margin-top:6px">Удалить запись</button>' : ''),
      footer: '<div class="btnrow"><button class="btn" id="ck-save">Сохранить</button></div>',
      onMount: function (el, close) {
        var inp = U.$('#ck-w', el); inp.focus(); inp.select();
        function save() {
          var w = U.num(inp.value);
          if (w === null || w <= 0 || w > 500) { App.toast('Введите корректный вес'); return; }
          DB.upsert('daily_checkins', function (r) { return r.date === d; }, { date: d, weight_kg: w, note: U.$('#ck-n', el).value.trim() || null });
          close(); App.toast('Вес ' + fmt(w) + ' кг сохранён', true); App.render();
        }
        U.$('#ck-save', el).onclick = save;
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
        var del = U.$('#ck-del', el);
        if (del) del.onclick = function () {
          App.confirm({
            title: 'Удалить запись веса?', message: 'Запись за ' + U.dateRu(d) + ' будет удалена.', danger: true, okText: 'Удалить',
            onOk: function () { DB.removeWhere('daily_checkins', function (r) { return r.date === d; }); close(); App.render(); App.toast('Запись удалена'); }
          });
        };
      }
    });
  };

  /* ================= КАРДИО ================= */
  var CARDIO_TYPES = ['Ходьба', 'Бег', 'Велосипед', 'Плавание', 'Эллипс', 'Другое'];
  App.modals.cardio = function (rec) {
    var isEdit = !!rec;
    rec = rec || { date: U.todayStr(), type: 'Бег', duration_min: null, distance_km: null, kcal: null };
    App.modal({
      title: isEdit ? 'Кардио — изменить' : 'Кардио',
      body:
        '<label class="f"><span class="lb">Дата</span><input type="date" id="cd-d" value="' + rec.date + '"></label>' +
        '<label class="f"><span class="lb">Тип</span><select id="cd-t">' +
        CARDIO_TYPES.map(function (t) { return '<option' + (t === rec.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
        '</select></label>' +
        '<div class="f-3">' +
        '<label class="f"><span class="lb">Минуты</span><input type="number" inputmode="numeric" id="cd-m" value="' + (rec.duration_min || '') + '"></label>' +
        '<label class="f"><span class="lb">Км</span><input type="number" inputmode="decimal" step="0.1" id="cd-km" value="' + (rec.distance_km || '') + '"></label>' +
        '<label class="f"><span class="lb">Ккал</span><input type="number" inputmode="numeric" id="cd-kc" value="' + (rec.kcal || '') + '"></label></div>' +
        '<p class="micro muted" style="margin:2px 0 0">Заполните хотя бы одно поле</p>',
      footer: (isEdit ? '<button class="btn danger" id="cd-del" style="margin-bottom:8px">Удалить</button>' : '') +
        '<div class="btnrow"><button class="btn" id="cd-save">' + (isEdit ? 'Сохранить' : 'Добавить') + '</button></div>',
      onMount: function (el, close) {
        U.$('#cd-save', el).onclick = function () {
          var m = U.num(U.$('#cd-m', el).value), km = U.num(U.$('#cd-km', el).value), kc = U.num(U.$('#cd-kc', el).value);
          if ((!m && !km && !kc) || (m != null && m <= 0)) { App.toast('Заполните хотя бы одно поле'); return; }
          var patch = {
            date: U.$('#cd-d', el).value || U.todayStr(), type: U.$('#cd-t', el).value,
            duration_min: m, distance_km: km, kcal: kc
          };
          if (isEdit) DB.update('cardio_sessions', rec.id, patch);
          else DB.insert('cardio_sessions', patch);
          close(); App.toast(isEdit ? 'Кардио обновлено' : 'Кардио добавлено', true); App.render();
        };
        var del = U.$('#cd-del', el);
        if (del) del.onclick = function () {
          App.confirm({
            title: 'Удалить кардио?', message: rec.type + ' за ' + U.dateRu(rec.date), danger: true, okText: 'Удалить',
            onOk: function () { DB.remove('cardio_sessions', rec.id); close(); App.render(); App.toast('Удалено'); }
          });
        };
      }
    });
  };

  /* ================= ШАГИ ================= */
  App.modals.steps = function (date) {
    var d = date || U.todayStr();
    var rec = DB.getWhere('daily_activity', function (r) { return r.date === d; });
    App.modal({
      title: 'Шаги — ' + U.dateRu(d),
      body: '<label class="f"><span class="lb">Количество шагов</span>' +
        '<input type="number" inputmode="numeric" id="st-n" value="' + (rec ? rec.steps : '') + '" placeholder="напр. 8500" autofocus></label>',
      footer: '<div class="btnrow"><button class="btn" id="st-save">Сохранить</button></div>',
      onMount: function (el, close) {
        var inp = U.$('#st-n', el); inp.focus(); inp.select();
        function save() {
          var n = U.num(inp.value);
          if (n === null || n < 0) { App.toast('Введите количество шагов'); return; }
          DB.upsert('daily_activity', function (r) { return r.date === d; }, { date: d, steps: Math.round(n) });
          close(); App.toast('Шаги сохранены', true); App.render();
        }
        U.$('#st-save', el).onclick = save;
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
      }
    });
  };

  /* ================= ЗАМЕРЫ ================= */
  App.modals.measure = function (rec) {
    var isEdit = !!rec;
    rec = rec || { date: U.todayStr(), waist_cm: null, chest_cm: null, arm_cm: null, hip_cm: null, neck_cm: null };
    function f(id, lb, v, ph) {
      return '<label class="f"><span class="lb">' + lb + '</span><input type="number" inputmode="decimal" step="0.5" id="' + id + '" value="' + (v || '') + '" placeholder="' + ph + '"></label>';
    }
    App.modal({
      title: isEdit ? 'Замер — изменить' : 'Замер тела',
      body:
        '<label class="f"><span class="lb">Дата</span><input type="date" id="ms-d" value="' + rec.date + '"></label>' +
        f('ms-w', 'Талия, см', rec.waist_cm, 'напр. 84') +
        '<div class="f-2">' + f('ms-c', 'Грудь, см', rec.chest_cm, '') + f('ms-a', 'Бицепс, см', rec.arm_cm, '') + '</div>' +
        '<div class="f-2">' + f('ms-h', 'Бёдра, см', rec.hip_cm, '') + f('ms-n', 'Шея, см', rec.neck_cm, '') + '</div>',
      footer: (isEdit ? '<button class="btn danger" id="ms-del" style="margin-bottom:8px">Удалить</button>' : '') +
        '<div class="btnrow"><button class="btn" id="ms-save">Сохранить</button></div>',
      onMount: function (el, close) {
        U.$('#ms-save', el).onclick = function () {
          var patch = {
            date: U.$('#ms-d', el).value || U.todayStr(),
            waist_cm: U.num(U.$('#ms-w', el).value), chest_cm: U.num(U.$('#ms-c', el).value),
            arm_cm: U.num(U.$('#ms-a', el).value), hip_cm: U.num(U.$('#ms-h', el).value),
            neck_cm: U.num(U.$('#ms-n', el).value)
          };
          var any = ['waist_cm', 'chest_cm', 'arm_cm', 'hip_cm', 'neck_cm'].some(function (k) { return patch[k] != null; });
          if (!any) { App.toast('Заполните хотя бы один замер'); return; }
          if (isEdit) DB.update('body_measurements', rec.id, patch);
          else DB.upsert('body_measurements', function (r) { return r.date === patch.date; }, patch);
          close(); App.toast('Замер сохранён', true); App.render();
        };
        var del = U.$('#ms-del', el);
        if (del) del.onclick = function () {
          App.confirm({
            title: 'Удалить замер?', message: 'Замер за ' + U.dateRu(rec.date), danger: true, okText: 'Удалить',
            onOk: function () { DB.remove('body_measurements', rec.id); close(); App.render(); App.toast('Удалено'); }
          });
        };
      }
    });
  };

  /* ================= ФОТО ================= */
  App.modals.addPhoto = function () {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var file = inp.files && inp.files[0];
      if (!file) return;
      U.resizeImage(file, 900, .72).then(function (dataUrl) {
        DB.insert('progress_photos', { date: U.todayStr(), data_url: dataUrl });
        App.toast('Фото добавлено', true); App.render();
      }).catch(function () { App.toast('Не удалось обработать фото'); });
    };
    inp.click();
  };

  App.modals.viewPhoto = function (rec) {
    App.modal({
      title: 'Фото — ' + U.dateRu(rec.date),
      body: '<img class="ph-view" src="' + rec.data_url + '" alt="">' +
        '<div class="btnrow"><button class="btn danger" id="pv-del">Удалить фото</button></div>',
      onMount: function (el, close) {
        U.$('#pv-del', el).onclick = function () {
          App.confirm({
            title: 'Удалить фото?', message: 'Фото от ' + U.dateRu(rec.date) + ' будет удалено.', danger: true, okText: 'Удалить',
            onOk: function () { DB.remove('progress_photos', rec.id); close(); App.render(); App.toast('Фото удалено'); }
          });
        };
      }
    });
  };

  /* ================= ЭКРАН ================= */
  App.screens.dashboard = function () {
    var t = U.todayStr();
    var goal = DB.get('goals', 'main') || { kcal: 2400, protein: 160, fat: 75, carbs: 250, steps: 8000 };
    var ck = checkinsSorted();
    var todayCk = ck.find(function (r) { return r.date === t; });
    var prevCk = null;
    for (var i = ck.length - 1; i >= 0; i--) { if (ck[i].date < t) { prevCk = ck[i]; break; } }
    var nutr = DB.dayNutrition(t);
    var act = DB.getWhere('daily_activity', function (r) { return r.date === t; });
    var cardio = DB.where('cardio_sessions', function (r) { return r.date === t; });
    var cardioMin = cardio.reduce(function (a, r) { return a + (r.duration_min || 0); }, 0);
    var cardioKm = cardio.reduce(function (a, r) { return a + (r.distance_km || 0); }, 0);
    var activeSession = DB.getWhere('workout_sessions', function (s) { return s.status === 'active'; });
    var doneToday = DB.where('workout_sessions', function (s) { return s.date === t && s.status === 'done'; });
    var sups = DB.list('supplements');
    var msr = DB.getWhere('body_measurements', function (r) { return r.date === t; });

    function pbar(val, max, cls) {
      var pct = max ? Math.min(100, val / max * 100) : 0;
      return '<div class="pbar ' + (cls || '') + '"><i style="width:' + pct + '%"></i></div>';
    }
    function deltaHtml(v) {
      if (v == null || Math.abs(v) < .05) return '<span class="muted tiny">= без изменений</span>';
      var up = v > 0;
      return '<span class="' + (up ? 'delta-up' : 'delta-down') + '">' + (up ? '▲ +' : '▼ ') + fmt(Math.abs(v)) + ' кг</span>';
    }

    var html = '';

    /* --- сетка статов --- */
    html += '<div class="stat2">';
    html += '<div class="card click" data-action="checkin">' +
      '<div class="row"><div class="grow"><div class="muted tiny">Вес</div>' +
      '<div class="big">' + (todayCk ? fmt(todayCk.weight_kg) + '<span class="tiny muted"> кг</span>' : '<span class="muted mid">—</span>') + '</div>' +
      '<div>' + (todayCk ? deltaHtml(prevCk ? todayCk.weight_kg - prevCk.weight_kg : null) : '<span class="muted tiny">Нажмите, чтобы добавить</span>') + '</div>' +
      '</div><div style="font-size:26px">⚖️</div></div></div>';

    var kcalPct = goal.kcal ? Math.round(nutr.totals.kcal / goal.kcal * 100) : 0;
    html += '<div class="card click" data-action="goFood">' +
      '<div class="row"><div class="grow"><div class="muted tiny">Питание</div>' +
      '<div class="big">' + nutr.totals.kcal + '<span class="tiny muted"> / ' + goal.kcal + ' ккал</span></div>' +
      pbar(nutr.totals.kcal, goal.kcal, nutr.totals.kcal > goal.kcal ? 'over' : '') +
      '<div class="micro muted" style="margin-top:4px">Б ' + Math.round(nutr.totals.p) + ' · Ж ' + Math.round(nutr.totals.f) + ' · У ' + Math.round(nutr.totals.c) + '</div>' +
      '</div><div style="font-size:26px">🍽</div></div></div>';

    html += '<div class="card click" data-action="steps">' +
      '<div class="row"><div class="grow"><div class="muted tiny">Шаги</div>' +
      '<div class="big">' + (act ? U.fmt(act.steps, 0) : '0') + '<span class="tiny muted"> / ' + U.fmt(goal.steps, 0) + '</span></div>' +
      pbar(act ? act.steps : 0, goal.steps) + '</div><div style="font-size:26px">👟</div></div></div>';

    html += '<div class="card click" data-action="cardio">' +
      '<div class="row"><div class="grow"><div class="muted tiny">Кардио сегодня</div>' +
      '<div class="big">' + cardioMin + '<span class="tiny muted"> мин</span></div>' +
      '<div class="micro muted" style="margin-top:4px">' + (cardioKm ? fmt(cardioKm) + ' км · ' : '') + (cardio.length ? cardio.length + ' зап.' : 'Добавить') + '</div>' +
      '</div><div style="font-size:26px">🏃</div></div></div>';
    html += '</div>';

    /* --- тренировка --- */
    html += '<div class="card">';
    html += '<div class="row"><div style="font-size:26px">🏋️</div><div class="grow">' +
      '<div class="mid">' + (activeSession ? 'Идёт тренировка' : doneToday.length ? 'Тренировка выполнена ✓' : 'Тренировка') + '</div>' +
      '<div class="tiny muted">' + (activeSession ? esc(activeSession.template_name) :
        doneToday.length ? esc(doneToday[0].template_name) + ' · ' + DB.setsOfSession(doneToday[0].id).length + ' подходов' :
          'Выберите шаблон и начните') + '</div></div>';
    html += activeSession
      ? '<button class="btn sm" data-action="continueSession" data-sid="' + activeSession.id + '">Продолжить</button>'
      : '<button class="btn sm" data-action="goWorkout">' + (doneToday.length ? 'Ещё' : 'Начать') + '</button>';
    html += '</div></div>';

    /* --- быстрые действия --- */
    html += '<h2 class="sec">Быстрые действия</h2><div class="qgrid">' +
      '<button class="qbtn" data-action="checkin"><span class="ico">⚖️</span>Вес</button>' +
      '<button class="qbtn" data-action="goFood"><span class="ico">🍽</span>Еда</button>' +
      '<button class="qbtn" data-action="cardio"><span class="ico">🏃</span>Кардио</button>' +
      '<button class="qbtn" data-action="steps"><span class="ico">👟</span>Шаги</button>' +
      '<button class="qbtn" data-action="measure"><span class="ico">📏</span>Замер</button>' +
      '<button class="qbtn" data-action="photo"><span class="ico">📷</span>Фото</button>' +
      '</div>';

    /* --- замер сегодня --- */
    if (msr) {
      var parts = [];
      if (msr.waist_cm != null) parts.push('талия ' + fmt(msr.waist_cm));
      if (msr.chest_cm != null) parts.push('грудь ' + fmt(msr.chest_cm));
      if (msr.arm_cm != null) parts.push('бицепс ' + fmt(msr.arm_cm));
      if (msr.hip_cm != null) parts.push('бёдра ' + fmt(msr.hip_cm));
      if (msr.neck_cm != null) parts.push('шея ' + fmt(msr.neck_cm));
      html += '<div class="lrow" data-action="measure"><div class="ico">📏</div><div class="grow"><div class="t">Замер сегодня</div><div class="s">' + esc(parts.join(' · ')) + '</div></div><span class="chev">›</span></div>';
    }

    /* --- добавки --- */
    if (sups.length) {
      html += '<h2 class="sec">Добавки</h2><div class="sup-row">' + sups.map(function (s) {
        var taken = (s.taken || []).indexOf(t) >= 0;
        return '<button class="chip ' + (taken ? 'on' : '') + '" data-action="supToggle" data-sid="' + s.id + '">' + (taken ? '✓ ' : '') + esc(s.name) + '</button>';
      }).join('') + '</div>';
    }

    App.U.$('#screen').innerHTML = html;
  };

  /* ---------- действия ---------- */
  App.actions.checkin = function () { App.modals.checkin(); };
  App.actions.cardio = function () { App.modals.cardio(); };
  App.actions.steps = function () { App.modals.steps(); };
  App.actions.measure = function () { App.modals.measure(); };
  App.actions.photo = function () { App.modals.addPhoto(); };
  App.actions.goFood = function () { App.go('food'); };
  App.actions.goWorkout = function () { App.go('workout'); };
  App.actions.supToggle = function (d) {
    var s = DB.get('supplements', d.sid); if (!s) return;
    var t = U.todayStr();
    var taken = s.taken || [];
    var i = taken.indexOf(t);
    if (i >= 0) taken.splice(i, 1); else taken.push(t);
    DB.update('supplements', s.id, { taken: taken });
    App.render();
  };
})();
