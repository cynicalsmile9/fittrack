/* ============================================================
   Экран «Тренировки»: шаблоны, сессии, цель и прошлый
   результат по каждому упражнению, ввод подходов, прогрессия,
   повтор тренировки. История — снапшотами, шаблон её не меняет.
   ============================================================ */
(function () {
  'use strict';
  var U = App.U, esc = U.esc, fmt = U.fmt, fmtW = U.fmtW;

  function fmtSets(sets) {
    return sets.map(function (s) { return fmtW(s.weight_kg) + '×' + s.reps; }).join(', ');
  }
  function lastFor(item, sess) {
    var excludeId = sess && sess.status === 'done' ? sess.id : null;
    return DB.lastSetsForExercise(item.exercise_id, excludeId);
  }
  function targetLine(item) {
    var reps = item.rep_min + '–' + item.rep_max;
    if (item.suggest != null && item.step_kg > 0) return 'Цель: ' + fmtW(item.suggest) + ' кг × ' + reps;
    if (item.suggest != null && item.step_kg === 0) return 'Цель: ' + reps + ' повт.' + (item.suggest ? '' : '');
    return 'Цель: ' + reps + ' повт.';
  }
  function exVolume(sets) {
    return sets.reduce(function (a, s) { return a + s.weight_kg * s.reps; }, 0);
  }

  /* ---------- карточка упражнения ---------- */
  function exCardHtml(sess, item, idx, isActive) {
    var last = lastFor(item, sess);
    var saved = DB.setsOfExerciseInSession(sess.id, item.exercise_id);
    var extras = App.state.sessionExtras[sess.id + '|' + item.exercise_id] || 0;
    var rows = Math.max(item.sets || 1, saved.length, isActive ? item.sets + extras : item.sets);

    var html = '<div class="ex-card" id="ex-' + idx + '">';
    html += '<div class="ex-h"><div class="nm">' + esc(item.name) + '</div><span class="tag acc">' + targetLine(item) + '</span></div>';

    if (last) {
      html += '<div class="last-res">Прошлая (' + U.dateRu(last.session.date) + '): <b style="color:var(--txt)">' + fmtSets(last.sets) + '</b>' +
        ' · объём ' + U.fmt(exVolume(last.sets), 0) + ' кг</div>';
    } else {
      html += '<div class="last-res">Первый раз — подберите комфортный вес по цели ' + (item.rep_min || 8) + '–' + (item.rep_max || 12) + ' повторов</div>';
    }

    html += '<div class="setrow" style="margin-top:10px"><span class="sn micro muted">№</span><span class="micro muted">Вес, кг</span><span class="micro muted">Повт.</span><span class="micro muted" style="text-align:center">Δ вес</span><span></span></div>';

    for (var i = 1; i <= rows; i++) {
      var st = saved.find(function (s) { return s.set_no === i; });
      var lastSet = last ? last.sets.find(function (s) { return s.set_no === i; }) : null;
      var prefill = (!st && isActive && i === 1 && item.suggest != null) ? item.suggest : '';
      html += '<div class="setrow' + (st ? ' done' : '') + '" data-setrow="' + sess.id + '|' + item.exercise_id + '|' + i + '">' +
        '<span class="sn">' + i + '</span>';
      if (isActive) {
        html += '<input type="number" inputmode="decimal" step="0.5" class="num" placeholder="—" value="' + (st ? st.weight_kg : prefill) + '" data-change="setInput" data-sid="' + sess.id + '" data-ex="' + item.exercise_id + '" data-no="' + i + '" data-field="weight">' +
          '<input type="number" inputmode="numeric" class="num" placeholder="—" value="' + (st ? st.reps : '') + '" data-change="setInput" data-sid="' + sess.id + '" data-ex="' + item.exercise_id + '" data-no="' + i + '" data-field="reps">';
      } else {
        html += '<div class="num" style="padding:9px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg2)">' + (st ? fmtW(st.weight_kg) : '—') + '</div>' +
          '<div class="num" style="padding:9px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg2)">' + (st ? st.reps : '—') + '</div>';
      }
      html += '<span class="set-delta">' + deltaText(st, lastSet) + '</span>';
      if (isActive) html += '<span style="text-align:center">' + (st ? '✅' : '') + '</span>';
      else html += '<button class="edit" style="color:var(--blue);font-size:15px" data-action="editSet" data-sid="' + sess.id + '" data-ex="' + item.exercise_id + '" data-no="' + i + '">✎</button>';
      html += '</div>';
    }

    if (isActive) {
      html += '<button class="addset" data-action="addSet" data-sid="' + sess.id + '" data-ex="' + item.exercise_id + '">＋ Подход</button>';
      html += '<div class="ex-foot" id="exfoot-' + idx + '" data-item=\'' + esc(JSON.stringify(item)) + '\'>' + footText(sess, item) + '</div>';
    } else {
      html += '<div class="ex-foot">' + footText(sess, item) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function deltaText(st, lastSet) {
    if (!st || !lastSet) return '';
    var d = st.weight_kg - lastSet.weight_kg;
    if (Math.abs(d) < 0.01) return '=';
    return d > 0 ? '▲' + (Math.round(d * 10) / 10) : '▼' + (Math.round(-d * 10) / 10);
  }

  function footText(sess, item) {
    var saved = DB.setsOfExerciseInSession(sess.id, item.exercise_id);
    if (!saved.length) return 'Введите вес и повторения — сохраняется автоматически.';
    var vol = exVolume(saved);
    var last = lastFor(item, sess);
    var line = 'Объём: ' + U.fmt(vol, 0) + ' кг';
    if (last && last.sets.length) {
      var dv = vol - exVolume(last.sets);
      line += dv >= 0 ? ' (▲' + U.fmt(dv, 0) + ' к прошлой)' : ' (▼' + U.fmt(-dv, 0) + ' к прошлой)';
    }
    var planned = Math.max(item.sets || 1, saved.length);
    var allMax = saved.length >= planned && saved.every(function (s) { return s.reps >= (item.rep_max || item.rep_min); });
    var sug = DB.suggestionFor(item, { sets: saved });
    if (sug && allMax) {
      if (item.step_kg > 0) line += '<br>💪 Все подходы ≥ ' + item.rep_max + ' повт. — <b>в следующий раз: ' + fmtW(sug.weight) + ' кг</b> (+' + fmtW(item.step_kg) + ')';
      else line += '<br>💪 Все подходы ≥ ' + item.rep_max + ' повт. — <b>в следующий раз: +' + (sug.repsPlus || 2) + ' повтора к подходам</b>';
    }
    return line;
  }

  /* ---------- вьюха сессии ---------- */
  App.views.session = function (sid) {
    return {
      title: DB.get('workout_sessions', sid) ? DB.get('workout_sessions', sid).template_name : 'Тренировка',
      render: function () {
        var sess = DB.get('workout_sessions', sid);
        if (!sess) { App.pop(); return; }
        var isActive = sess.status === 'active';
        var vol = DB.sessionVolume(sid);
        var setsCount = DB.setsOfSession(sid).length;

        var html = '<div class="card"><div class="row">' +
          '<div class="grow"><div class="mid">' + esc(sess.template_name) + '</div>' +
          '<div class="tiny muted" id="sess-meta">' + U.dateRu(sess.date) + ' · подходов: ' + setsCount + ' · объём ' + U.fmt(vol, 0) + ' кг</div></div></div>';
        if (isActive) {
          html += '<div class="btnrow"><button class="btn" data-action="finishSession" data-sid="' + sid + '">✓ Завершить тренировку</button></div>';
        } else {
          html += '<div class="btnrow">' +
            '<button class="btn sec" data-action="repeatSession" data-sid="' + sid + '">🔁 Повторить тренировку</button>' +
            '<button class="btn danger" data-action="deleteSession" data-sid="' + sid + '">Удалить</button></div>';
        }
        html += '</div>';

        sess.items.forEach(function (item, idx) {
          html += exCardHtml(sess, item, idx, isActive);
        });

        U.$('#screen').innerHTML = html;
      }
    };
  };

  /* ---------- ввод подхода (active) ---------- */
  App.actions.setInput = function (d, el) {
    var sess = DB.get('workout_sessions', d.sid); if (!sess || sess.status !== 'active') return;
    var row = el.closest('.setrow');
    var wIn = row.querySelector('[data-field=weight]'), rIn = row.querySelector('[data-field=reps]');
    var w = U.num(wIn.value), r = U.num(rIn.value);
    var no = +d.no;
    var match = function (s) { return s.session_id === d.sid && s.exercise_id === d.ex && s.set_no === no; };
    if (w == null && r == null) {
      DB.removeWhere('workout_sets', match);
    } else {
      DB.upsert('workout_sets', match, {
        session_id: d.sid, exercise_id: d.ex, set_no: no,
        weight_kg: w || 0, reps: r || 0
      });
    }
    /* точечное обновление без перерисовки (чтобы не терять фокус) */
    var saved = DB.setsOfExerciseInSession(d.sid, d.ex).find(function (s) { return s.set_no === no; });
    row.classList.toggle('done', !!saved);
    var dot = row.querySelector('span:last-child');
    if (dot && dot.tagName === 'SPAN' && !dot.classList.contains('set-delta')) dot.textContent = saved ? '✅' : '';
    var item = sess.items.find(function (it) { return it.exercise_id === d.ex; });
    var last = lastFor(item, sess);
    var lastSet = last ? last.sets.find(function (s) { return s.set_no === no; }) : null;
    var deltaEl = row.querySelector('.set-delta');
    if (deltaEl) deltaEl.textContent = deltaText(saved, lastSet);
    var idx = sess.items.indexOf(item);
    var foot = U.$('#exfoot-' + idx);
    if (foot) foot.innerHTML = footText(sess, item);
    var volEl = U.$('#sess-vol');
    if (volEl) volEl.textContent = 'объём ' + U.fmt(DB.sessionVolume(d.sid), 0) + ' кг';
    var metaEl = U.$('#sess-meta');
    if (metaEl) metaEl.textContent = U.dateRu(sess.date) + ' · подходов: ' +
      DB.setsOfSession(d.sid).length + ' · объём ' + U.fmt(DB.sessionVolume(d.sid), 0) + ' кг';
  };

  App.actions.addSet = function (d) {
    var key = d.sid + '|' + d.ex;
    App.state.sessionExtras[key] = (App.state.sessionExtras[key] || 0) + 1;
    var sess = DB.get('workout_sessions', d.sid); if (!sess) return;
    var item = sess.items.find(function (it) { return it.exercise_id === d.ex; });
    var idx = sess.items.indexOf(item);
    var rows = Math.max(item.sets || 1, DB.setsOfExerciseInSession(d.sid, d.ex).length) + 1;
    var html = '<span class="sn">' + rows + '</span>' +
      '<input type="number" inputmode="decimal" step="0.5" class="num" placeholder="—" data-change="setInput" data-sid="' + d.sid + '" data-ex="' + d.ex + '" data-no="' + rows + '" data-field="weight">' +
      '<input type="number" inputmode="numeric" class="num" placeholder="—" data-change="setInput" data-sid="' + d.sid + '" data-ex="' + d.ex + '" data-no="' + rows + '" data-field="reps">' +
      '<span class="set-delta"></span><span></span>';
    var row = document.createElement('div');
    row.className = 'setrow';
    row.innerHTML = html;
    var card = U.$('#ex-' + idx);
    card.insertBefore(row, card.querySelector('.addset'));
  };

  /* ---------- редактирование подхода в завершённой сессии ---------- */
  App.actions.editSet = function (d) {
    var st = DB.getWhere('workout_sets', function (s) {
      return s.session_id === d.sid && s.exercise_id === d.ex && s.set_no === +d.no;
    });
    App.modal({
      title: 'Подход №' + d.no,
      body: '<div class="f-2">' +
        '<label class="f"><span class="lb">Вес, кг</span><input type="number" inputmode="decimal" step="0.5" id="es-w" value="' + (st ? st.weight_kg : '') + '"></label>' +
        '<label class="f"><span class="lb">Повторения</span><input type="number" inputmode="numeric" id="es-r" value="' + (st ? st.reps : '') + '"></label></div>',
      footer: (st ? '<button class="btn danger" id="es-del" style="margin-bottom:8px">Удалить подход</button>' : '') +
        '<div class="btnrow"><button class="btn" id="es-save">Сохранить</button></div>',
      onMount: function (el, close) {
        U.$('#es-save', el).onclick = function () {
          var w = U.num(U.$('#es-w', el).value), r = U.num(U.$('#es-r', el).value);
          if (w == null || r == null) { App.toast('Заполните вес и повторения'); return; }
          DB.upsert('workout_sets', function (s) { return s.session_id === d.sid && s.exercise_id === d.ex && s.set_no === +d.no; },
            { session_id: d.sid, exercise_id: d.ex, set_no: +d.no, weight_kg: w, reps: r });
          close(); App.render(); App.toast('Подход обновлён', true);
        };
        var del = U.$('#es-del', el);
        if (del) del.onclick = function () {
          DB.removeWhere('workout_sets', function (s) { return s.session_id === d.sid && s.exercise_id === d.ex && s.set_no === +d.no; });
          close(); App.render(); App.toast('Подход удалён');
        };
      }
    });
  };

  /* ---------- завершение / повтор / удаление сессии ---------- */
  App.actions.finishSession = function (d) {
    var sess = DB.get('workout_sessions', d.sid); if (!sess) return;
    var setsCount = DB.setsOfSession(d.sid).length;
    if (!setsCount) {
      App.confirm({
        title: 'Нет введённых подходов', message: 'Завершить и удалить пустую тренировку?', danger: true, okText: 'Удалить',
        onOk: function () { DB.remove('workout_sessions', d.sid); App.go('workout'); App.toast('Пустая тренировка удалена'); }
      });
      return;
    }
    DB.update('workout_sessions', d.sid, { status: 'done', finished_at: new Date().toISOString() });
    App.toast('Тренировка сохранена: ' + setsCount + ' подходов, объём ' + U.fmt(DB.sessionVolume(d.sid), 0) + ' кг', true);
    App.go('workout');
  };

  function dropActiveSession() {
    var act = DB.getWhere('workout_sessions', function (s) { return s.status === 'active'; });
    if (act) {
      DB.removeWhere('workout_sets', function (s) { return s.session_id === act.id; });
      DB.remove('workout_sessions', act.id);
    }
    return !!act;
  }
  function startNewFromTemplate(tpl) {
    var act = DB.getWhere('workout_sessions', function (s) { return s.status === 'active'; });
    function create() {
      dropActiveSession();
      var sess = DB.createSessionFromTemplate(tpl);
      App.go('workout');
      App.push(App.views.session(sess.id));
    }
    if (act) {
      App.confirm({
        title: 'Завершить текущую тренировку?', message: 'У вас есть незавершённая «' + act.template_name + '». Она будет удалена и заменена новой.', danger: true, okText: 'Начать новую',
        onOk: create
      });
    } else create();
  }

  App.actions.repeatSession = function (d) {
    var sess = DB.get('workout_sessions', d.sid); if (!sess) return;
    var tpl = DB.get('workout_templates', sess.template_id);
    if (tpl && tpl.items && tpl.items.length) startNewFromTemplate(tpl);
    else {
      /* шаблон удалён — создаём по снапшоту */
      dropActiveSession();
      var newSess = DB.createSessionFromTemplate({ id: sess.template_id, name: sess.template_name, items: sess.items.map(function (it) {
        return { exercise_id: it.exercise_id, name: it.name, sets: it.sets, rep_min: it.rep_min, rep_max: it.rep_max, step_kg: it.step_kg };
      }) });
      App.go('workout');
      App.push(App.views.session(newSess.id));
    }
  };

  App.actions.deleteSession = function (d) {
    var sess = DB.get('workout_sessions', d.sid); if (!sess) return;
    App.confirm({
      title: 'Удалить тренировку?', message: '«' + sess.template_name + '» за ' + U.dateRu(sess.date) + ' и все её подходы будут удалены.', danger: true, okText: 'Удалить',
      onOk: function () {
        DB.removeWhere('workout_sets', function (s) { return s.session_id === d.sid; });
        DB.remove('workout_sessions', d.sid);
        App.pop(); App.toast('Тренировка удалена');
      }
    });
  };

  App.actions.continueSession = function (d) {
    App.push(App.views.session(d.sid));
  };

  /* ---------- выбор упражнения ---------- */
  function exercisePicker(onPick) {
    App.modal({
      title: 'Упражнение',
      body: '<input type="text" id="ep-q" placeholder="Поиск упражнения…" style="margin-bottom:10px">' +
        '<div id="ep-list" class="modal-scroll"></div>' +
        '<div class="divider"></div><label class="f"><span class="lb">Или новое: название</span><input type="text" id="ep-new"></label>' +
        '<label class="f"><span class="lb">Группа мышц</span><input type="text" id="ep-m" placeholder="Спина, Грудь, Ноги…"></label>' +
        '<button class="btn sec" id="ep-add">＋ Создать упражнение</button>',
      onMount: function (el, close) {
        var listEl = U.$('#ep-list', el);
        function renderList() {
          var q = U.$('#ep-q', el).value.trim().toLowerCase();
          var arr = DB.list('exercises').sort(function (a, b) { return (b.usage || 0) - (a.usage || 0) || a.name.localeCompare(b.name, 'ru'); });
          if (q) arr = arr.filter(function (e) { return e.name.toLowerCase().indexOf(q) >= 0; });
          listEl.innerHTML = arr.slice(0, 60).map(function (e) {
            return '<div class="fp-row" data-ex="' + e.id + '"><div class="nm">' + esc(e.name) + '</div><div class="kb">' + esc(e.muscle || '') + '</div></div>';
          }).join('') || '<div class="empty">Не найдено — создайте ниже</div>';
        }
        renderList();
        U.$('#ep-q', el).addEventListener('input', renderList);
        listEl.addEventListener('click', function (e) {
          var row = e.target.closest('[data-ex]'); if (!row) return;
          pick(DB.get('exercises', row.dataset.ex));
        });
        U.$('#ep-add', el).onclick = function () {
          var name = U.$('#ep-new', el).value.trim();
          if (!name) { App.toast('Введите название'); return; }
          pick(DB.insert('exercises', { name: name, muscle: U.$('#ep-m', el).value.trim() || 'Другое', usage: 0 }));
        };
        function pick(ex) {
          DB.update('exercises', ex.id, { usage: (ex.usage || 0) + 1 });
          close(); onPick(ex);
        }
      }
    });
  }

  /* ---------- редактор шаблона ---------- */
  function templateEditor(tpl) {
    var items = tpl ? JSON.parse(JSON.stringify(tpl.items)) : [];
    App.modal({
      title: tpl ? 'Изменить шаблон' : 'Новый шаблон',
      body: '<label class="f"><span class="lb">Название</span><input type="text" id="tp-n" value="' + (tpl ? esc(tpl.name) : '') + '" placeholder="напр. Верх тела"></label>' +
        '<div id="tp-items"></div>' +
        '<button class="btn sec" id="tp-add" style="margin-top:4px">＋ Упражнение</button>' +
        '<p class="micro muted" style="margin:8px 0 0">Шаг — на сколько кг увеличивать вес, когда достигнута верхняя граница повторений. 0 = упражнение с весом тела.</p>',
      footer: (tpl ? '<button class="btn danger" id="tp-del" style="margin-bottom:8px">Удалить шаблон</button>' : '') +
        '<div class="btnrow"><button class="btn" id="tp-save">Сохранить шаблон</button></div>',
      onMount: function (el, close) {
        var wrap = U.$('#tp-items', el);

        function readItem(i, prev) {
          function v(id) { var e2 = U.$('#' + id, el); return e2 ? U.num(e2.value) : null; }
          return {
            exercise_id: prev.exercise_id, name: prev.name,
            sets: v('tp-sets-' + i) != null ? v('tp-sets-' + i) : prev.sets,
            rep_min: v('tp-min-' + i) != null ? v('tp-min-' + i) : prev.rep_min,
            rep_max: v('tp-max-' + i) != null ? v('tp-max-' + i) : prev.rep_max,
            step_kg: v('tp-step-' + i) != null ? v('tp-step-' + i) : prev.step_kg
          };
        }
        function readAll() { return items.map(function (it, i) { return readItem(i, it); }); }

        function numCell(lb, id, val, ph) {
          return '<div><span class="micro muted" style="display:block;text-align:center;margin-bottom:3px">' + lb + '</span>' +
            '<input type="number" inputmode="decimal" step="0.5" class="num rep-in" style="width:100%;padding:8px 2px" id="' + id + '" value="' + (val != null ? val : '') + '" placeholder="' + ph + '"></div>';
        }
        function renderItems() {
          if (!items.length) { wrap.innerHTML = '<div class="empty">Добавьте упражнения</div>'; return; }
          wrap.innerHTML = items.map(function (it, i) {
            return '<div class="card" style="margin-bottom:8px;padding:10px">' +
              '<div class="row"><button class="chip" data-tpick="' + i + '" style="flex:1;justify-content:flex-start;min-width:0">' + esc(it.name || 'Выбрать упражнение') + '</button>' +
              '<button data-tdel="' + i + '" style="color:var(--red);background:none;border:none;font-size:15px;padding:6px">✕</button></div>' +
              '<div class="setrow" style="grid-template-columns:repeat(4,1fr);margin-top:8px">' +
              numCell('Подходов', 'tp-sets-' + i, it.sets, 3) +
              numCell('Повт. от', 'tp-min-' + i, it.rep_min, 8) +
              numCell('Повт. до', 'tp-max-' + i, it.rep_max, 12) +
              numCell('Шаг, кг', 'tp-step-' + i, it.step_kg, 2.5) +
              '</div></div>';
          }).join('');
        }
        renderItems();

        wrap.addEventListener('click', function (e) {
          var del = e.target.closest('[data-tdel]');
          if (del) { items = readAll(); items.splice(+del.dataset.tdel, 1); renderItems(); return; }
          var pick = e.target.closest('[data-tpick]');
          if (pick) {
            var i = +pick.dataset.tpick;
            exercisePicker(function (ex) {
              items = readAll();
              items[i].exercise_id = ex.id; items[i].name = ex.name;
              renderItems();
            });
          }
        });

        U.$('#tp-add', el).onclick = function () {
          exercisePicker(function (ex) {
            items = readAll();
            items.push({ exercise_id: ex.id, name: ex.name, sets: 3, rep_min: 8, rep_max: 12, step_kg: 2.5 });
            renderItems();
          });
        };

        U.$('#tp-save', el).onclick = function () {
          var nm = U.$('#tp-n', el).value.trim();
          if (!nm) { App.toast('Введите название'); return; }
          var final = readAll();
          if (!final.length) { App.toast('Добавьте упражнения'); return; }
          for (var i = 0; i < final.length; i++) {
            var it = final[i];
            if (!it.exercise_id || !it.name) { App.toast('Упражнение №' + (i + 1) + ': выберите упражнение'); return; }
            if (!(it.sets >= 1 && it.sets <= 15)) { App.toast('Подходы: от 1 до 15'); return; }
            if (!(it.rep_min >= 1 && it.rep_max >= it.rep_min && it.rep_max <= 1000)) { App.toast('Повторы: «от» ≤ «до»'); return; }
            if (!(it.step_kg >= 0)) { App.toast('Шаг не может быть отрицательным'); return; }
          }
          if (tpl) { DB.update('workout_templates', tpl.id, { name: nm, items: final }); App.toast('Шаблон обновлён', true); }
          else { DB.insert('workout_templates', { name: nm, items: final }); App.toast('Шаблон «' + nm + '» создан', true); }
          close(); App.render();
        };
        var del = U.$('#tp-del', el);
        if (del) del.onclick = function () {
          App.confirm({
            title: 'Удалить шаблон?', message: '«' + tpl.name + '» будет удалён. История завершённых тренировок сохранится.', danger: true, okText: 'Удалить',
            onOk: function () { DB.remove('workout_templates', tpl.id); close(); App.render(); App.toast('Шаблон удалён'); }
          });
        };
      }
    });
  }

  /* ---------- экран «Тренировки» ---------- */
  App.screens.workout = function () {
    var act = DB.getWhere('workout_sessions', function (s) { return s.status === 'active'; });
    var tpls = DB.list('workout_templates');
    var done = DB.sessionsDone();

    var html = '';

    if (act) {
      html += '<div class="card" style="border-color:var(--acc)"><div class="row">' +
        '<div style="font-size:26px">🔴</div><div class="grow"><div class="mid">Идёт тренировка</div>' +
        '<div class="tiny muted">' + esc(act.template_name) + ' · ' + DB.setsOfSession(act.id).length + ' подходов введено</div></div>' +
        '<button class="btn sm" data-action="continueSession" data-sid="' + act.id + '">Продолжить</button></div></div>';
    }

    html += '<h2 class="sec">Шаблоны</h2>';
    if (!tpls.length) html += '<div class="empty">Нет шаблонов</div>';
    tpls.forEach(function (t) {
      var last = done.find(function (s) { return s.template_id === t.id; });
      html += '<div class="card"><div class="tpl-row">' +
        '<div class="grow click" data-action="startSession" data-tid="' + t.id + '">' +
        '<div class="mid">' + esc(t.name) + '</div>' +
        '<div class="tiny muted">' + t.items.length + ' упражн. · ' + (last ? 'последняя: ' + U.dateRu(last.date) : 'ещё не выполнялся') + '</div></div>' +
        '<button class="btn sm sec" data-action="editTemplate" data-tid="' + t.id + '">✎</button>' +
        '<button class="btn sm" data-action="startSession" data-tid="' + t.id + '">' + (last ? 'Начать' : 'Старт') + '</button>' +
        '</div></div>';
    });
    html += '<button class="btn sec" data-action="newTemplate">＋ Новый шаблон</button>';

    html += '<h2 class="sec">История тренировок</h2>';
    if (!done.length) html += '<div class="empty">Завершённых тренировок пока нет</div>';
    done.slice(0, 50).forEach(function (s) {
      var setsCount = DB.setsOfSession(s.id).length;
      html += '<div class="lrow" data-action="openSession" data-sid="' + s.id + '">' +
        '<div class="ico">🏋️</div><div class="grow"><div class="t">' + esc(s.template_name) + '</div>' +
        '<div class="s">' + U.dateRu(s.date) + ' · ' + setsCount + ' подходов · объём ' + U.fmt(DB.sessionVolume(s.id), 0) + ' кг</div></div>' +
        '<span class="chev">›</span></div>';
    });

    U.$('#screen').innerHTML = html;
  };

  App.actions.startSession = function (d) {
    var tpl = DB.get('workout_templates', d.tid); if (!tpl) return;
    startNewFromTemplate(tpl);
  };
  App.actions.newTemplate = function () { templateEditor(null); };
  App.actions.editTemplate = function (d) {
    var tpl = DB.get('workout_templates', d.tid); if (tpl) templateEditor(tpl);
  };
  App.actions.openSession = function (d) { App.push(App.views.session(d.sid || d.arg)); };
})();
