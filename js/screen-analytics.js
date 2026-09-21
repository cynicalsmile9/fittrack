/* ============================================================
   Экран «Аналитика»: графики веса, талии, калорий, шагов,
   история упражнения, фото прогресса.
   ============================================================ */
(function () {
  'use strict';
  var U = App.U, esc = U.esc, fmt = U.fmt;

  function lastNdays(n, fn) {
    var out = [], t = U.todayStr();
    for (var i = n - 1; i >= 0; i--) {
      var d = U.addDays(t, -i);
      out.push({ date: d, label: U.dateShort(d), value: fn(d) });
    }
    return out;
  }

  App.screens.analytics = function () {
    var goal = DB.get('goals', 'main');
    var html = '';

    /* ---- вес ---- */
    var cks = DB.list('daily_checkins').slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var ckPts = cks.slice(-60).map(function (r) { return { label: U.dateShort(r.date), value: r.weight_kg }; });
    html += '<h2 class="sec" style="margin-top:2px">Вес, кг</h2><div class="card"><div class="chart-wrap">' +
      U.lineChart(ckPts) + '</div>';
    if (cks.length >= 2) {
      var first = cks[Math.max(0, cks.length - 60)], last = cks[cks.length - 1];
      var dv = last.weight_kg - first.weight_kg;
      html += '<div class="legend"><span>' + U.dateRu(first.date) + ': ' + fmt(first.weight_kg) + ' кг</span>' +
        '<span class="' + (dv > 0 ? 'delta-up' : 'delta-down') + '">' + (dv > 0 ? '+' : '') + fmt(dv) + ' кг</span></div>';
    }
    html += '</div>';

    /* ---- талия ---- */
    var msr = DB.where('body_measurements', function (m) { return m.waist_cm != null; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var msPts = msr.slice(-60).map(function (r) { return { label: U.dateShort(r.date), value: r.waist_cm }; });
    html += '<h2 class="sec">Талия, см</h2><div class="card"><div class="chart-wrap">' + U.lineChart(msPts) + '</div>';
    if (msPts.length >= 2) {
      var f = msPts[0], l = msPts[msPts.length - 1];
      html += '<div class="legend"><span>было ' + fmt(f.value) + ' см</span><span class="' + (l.value - f.value < 0 ? 'delta-up' : 'delta-down') + '">' +
        (l.value - f.value > 0 ? '+' : '') + fmt(l.value - f.value) + ' см</span></div>';
    }
    html += '</div>';

    /* ---- калории ---- */
    var kcalPts = lastNdays(14, function (d) { return DB.dayNutrition(d).totals.kcal; });
    html += '<h2 class="sec">Калории, 14 дней</h2><div class="card"><div class="chart-wrap">' +
      U.barChart(kcalPts, { goal: goal.kcal }) + '</div></div>';

    /* ---- шаги ---- */
    var stepPts = lastNdays(14, function (d) {
      var a = DB.getWhere('daily_activity', function (r) { return r.date === d; });
      return a ? a.steps : 0;
    });
    html += '<h2 class="sec">Шаги, 14 дней</h2><div class="card"><div class="chart-wrap">' +
      U.barChart(stepPts, { goal: goal.steps }) + '</div></div>';

    /* ---- история упражнения ---- */
    var usedEx = {};
    DB.list('workout_sets').forEach(function (s) { usedEx[s.exercise_id] = true; });
    var exList = Object.keys(usedEx).map(function (id) { return DB.get('exercises', id); })
      .filter(Boolean).sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });

    html += '<h2 class="sec">История упражнения</h2><div class="card">';
    if (!exList.length) {
      html += '<div class="empty">Заполните тренировку — здесь появится прогресс по упражнениям</div>';
    } else {
      if (!App.state.analyticsEx || !exList.find(function (e) { return e.id === App.state.analyticsEx; })) {
        App.state.analyticsEx = exList[0].id;
      }
      html += '<label class="f"><span class="lb">Упражнение</span><select id="an-ex">' +
        exList.map(function (e) {
          return '<option value="' + e.id + '"' + (e.id === App.state.analyticsEx ? ' selected' : '') + '>' + esc(e.name) + '</option>';
        }).join('') + '</select></label>';

      var exId = App.state.analyticsEx;
      var rows = [];
      DB.sessionsDone().forEach(function (s) {
        var sets = DB.setsOfExerciseInSession(s.id, exId);
        if (sets.length) {
          var top = Math.max.apply(null, sets.map(function (x) { return x.weight_kg; }));
          rows.push({ date: s.date, sid: s.id, top: top, vol: exVol(sets), sets: sets });
        }
      });
      function exVol(sets) { return sets.reduce(function (a, s2) { return a + s2.weight_kg * s2.reps; }, 0); }
      if (rows.length) {
        rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        html += '<div class="chart-wrap">' + U.lineChart(rows.map(function (r) { return { label: U.dateShort(r.date), value: r.top }; }),
          {}) + '</div><div class="legend"><span>топ-сет, кг</span></div>';
        var byDate = {};
        rows.slice().reverse().forEach(function (r) {
          var key = r.date;
          byDate[key] = (byDate[key] || 0) + 1;
        });
        html += '<div style="margin-top:10px">' + rows.slice().reverse().map(function (r) {
          return '<div class="lrow" data-action="openSession" data-sid="' + r.sid + '">' +
            '<div class="grow"><div class="t" style="font-weight:500">' + U.dateRu(r.date) + '</div>' +
            '<div class="s">' + r.sets.map(function (s2) { return U.fmtW(s2.weight_kg) + '×' + s2.reps; }).join(', ') + ' · объём ' + U.fmt(r.vol, 0) + ' кг</div></div>' +
            '<div class="mid acc">' + U.fmtW(r.top) + ' кг</div></div>';
        }).join('') + '</div>';
      } else {
        html += '<div class="empty">Нет подходов по этому упражнению</div>';
      }
    }
    html += '</div>';

    /* ---- фото ---- */
    var photos = DB.list('progress_photos').sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    html += '<h2 class="sec">Фото прогресса</h2><div class="card">' +
      '<button class="btn sec" style="margin-bottom:10px" data-action="photo">📷 Добавить фото</button>';
    if (photos.length) {
      html += '<div class="ph-grid">' + photos.map(function (p) {
        return '<img src="' + p.data_url + '" alt="' + U.dateRu(p.date) + '" data-action="viewPhotoRec" data-pid="' + p.id + '">';
      }).join('') + '</div>';
    } else html += '<div class="empty">Пока нет фото</div>';
    html += '</div>';

    U.$('#screen').innerHTML = html;

    var sel = U.$('#an-ex');
    if (sel) sel.addEventListener('change', function () {
      App.state.analyticsEx = this.value;
      App.render();
    });
  };

  App.actions.viewPhotoRec = function (d) {
    var p = DB.get('progress_photos', d.pid);
    if (p) App.modals.viewPhoto(p);
  };
})();
