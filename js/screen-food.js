/* ============================================================
   Экран «Питание»: приёмы пищи, КБЖУ, продукты и блюда,
   копирование вчерашнего дня.
   ============================================================ */
(function () {
  'use strict';
  var U = App.U, esc = U.esc, fmt = U.fmt;

  function mealName(type) {
    var m = App.MEAL_TYPES.find(function (x) { return x.id === type; });
    return m ? m : { name: type, icon: '🍽' };
  }

  function foodLabel(food) {
    return esc(food.name) + (food.is_dish ? ' <span class="micro blue">(блюдо)</span>' : '');
  }

  /* ---------- редактирование позиции приёма пищи ---------- */
  App.modals.mealItem = function (itemId, after) {
    var item = DB.get('meal_items', itemId); if (!item) return;
    var food = DB.get('foods', item.food_id); if (!food) return;
    App.modal({
      title: food.name,
      body:
        '<div class="last-res">' + fmt(food.protein) + 'Б / ' + fmt(food.fat) + 'Ж / ' + fmt(food.carbs) + 'У на 100 г · ' + DB.foodKcal(food) + ' ккал/100 г</div>' +
        '<label class="f" style="margin-top:12px"><span class="lb">Количество, г</span>' +
        '<input type="number" inputmode="numeric" id="mi-g" value="' + item.grams + '" autofocus></label>' +
        '<div class="micro muted" id="mi-prev"></div>',
      footer: '<button class="btn danger" id="mi-del" style="margin-bottom:8px">Удалить из приёма</button>' +
        '<div class="btnrow"><button class="btn" id="mi-save">Сохранить</button></div>',
      onMount: function (el, close) {
        var inp = U.$('#mi-g', el);
        function prev() {
          var g = U.num(inp.value);
          var n = g != null ? DB.itemNutr({ grams: g }, food) : null;
          U.$('#mi-prev', el).textContent = n ? 'Итого: ' + Math.round(n.kcal) + ' ккал · Б ' + fmt(n.p) + ' · Ж ' + fmt(n.f) + ' · У ' + fmt(n.c) : '';
        }
        inp.addEventListener('input', prev); prev();
        inp.focus(); inp.select();
        U.$('#mi-save', el).onclick = function () {
          var g = U.num(inp.value);
          if (g == null || g <= 0) { App.toast('Введите граммы'); return; }
          DB.update('meal_items', item.id, { grams: g });
          close(); App.toast('Изменено: ' + food.name + ' — ' + g + ' г', true);
          if (after) after(); else App.render();
        };
        U.$('#mi-del', el).onclick = function () {
          DB.remove('meal_items', item.id);
          close(); App.toast('Удалено: ' + food.name);
          if (after) after(); else App.render();
        };
      }
    });
  };

  /* ---------- выбор количества продукта ---------- */
  function amountModal(food, date, mealType, afterAdd) {
    App.modal({
      title: food.name,
      body:
        '<div class="last-res">' + fmt(food.protein) + 'Б / ' + fmt(food.fat) + 'Ж / ' + fmt(food.carbs) + 'У на 100 г · ' + DB.foodKcal(food) + ' ккал/100 г</div>' +
        '<label class="f" style="margin-top:12px"><span class="lb">Сколько грамм?</span>' +
        '<input type="number" inputmode="numeric" id="am-g" value="' + (food.last_grams || 100) + '" autofocus></label>' +
        '<div class="micro muted" id="am-prev"></div>',
      footer: '<div class="btnrow"><button class="btn sec" id="am-cancel">Отмена</button><button class="btn" id="am-add">Добавить</button></div>',
      onMount: function (el, close) {
        var inp = U.$('#am-g', el);
        var mt = mealName(mealType);
        function prev() {
          var g = U.num(inp.value);
          var n = g != null ? DB.itemNutr({ grams: g }, food) : null;
          U.$('#am-prev', el).textContent = n ? mt.icon + ' ' + mt.name + ' · ' + Math.round(n.kcal) + ' ккал · Б ' + fmt(n.p) + ' · Ж ' + fmt(n.f) + ' · У ' + fmt(n.c) : '';
        }
        inp.addEventListener('input', prev); prev();
        inp.focus(); inp.select();
        function add() {
          var g = U.num(inp.value);
          if (g == null || g <= 0) { App.toast('Введите граммы'); return; }
          var meal = DB.upsert('meals', function (m) { return m.date === date && m.type === mealType; }, { date: date, type: mealType });
          DB.insert('meal_items', { meal_id: meal.id, food_id: food.id, grams: g });
          DB.update('foods', food.id, { usage: (food.usage || 0) + 1, last_grams: g });
          close();
          App.toast('Добавлено: ' + food.name + ' — ' + g + ' г', true);
          afterAdd();
        }
        U.$('#am-add', el).onclick = add;
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
        U.$('#am-cancel', el).onclick = close;
      }
    });
  }

  /* ---------- пикер продукта ---------- */
  function foodPicker(date, mealType) {
    var all = DB.list('foods');
    App.modal({
      title: 'Выбрать продукт — ' + mealName(mealType).name,
      body:
        '<input type="text" id="fp-q" placeholder="Поиск: творог, рис, грудка…" style="margin-bottom:10px">' +
        '<div class="btnrow" style="margin:0 0 10px"><button class="btn sec sm" id="fp-newp">＋ Новый продукт</button>' +
        '<button class="btn sec sm" id="fp-newd">＋ Новое блюдо</button></div>' +
        '<div id="fp-list" class="modal-scroll"></div>' +
        '<div class="divider"></div><div class="micro muted" id="fp-total"></div>' +
        '<div class="btnrow"><button class="btn sec" id="fp-done">Готово</button></div>',
      onMount: function (el, close) {
        var listEl = U.$('#fp-list', el);
        function rowHtml(f) {
          return '<div class="fp-row" data-fp="' + f.id + '">' +
            '<div class="nm">' + foodLabel(f) + '</div>' +
            '<div class="kb">' + DB.foodKcal(f) + ' ккал<br>' + fmt(f.protein) + 'Б ' + fmt(f.fat) + 'Ж ' + fmt(f.carbs) + 'У</div>' +
            '<button class="edit" data-fpedit="' + f.id + '" title="Изменить">✎</button></div>';
        }
        function renderList() {
          var q = U.$('#fp-q', el).value.trim().toLowerCase();
          var arr = all.slice();
          arr.sort(function (a, b) {
            if ((b.usage || 0) !== (a.usage || 0)) return (b.usage || 0) - (a.usage || 0);
            return a.name.localeCompare(b.name, 'ru');
          });
          if (q) arr = arr.filter(function (f) { return f.name.toLowerCase().indexOf(q) >= 0; });
          var freq = !q && arr.filter(function (f) { return (f.usage || 0) > 0; }).length;
          var html = (!q && freq) ? '<div class="micro muted" style="margin:2px 0 6px">Частые</div>' : '';
          var shown = 0;
          if (!q && freq) {
            arr.slice(0, Math.min(5, freq)).forEach(function (f) { html += rowHtml(f); shown++; });
            html += '<div class="micro muted" style="margin:8px 0 6px">Все продукты</div>';
          }
          arr.slice(shown).slice(0, 80).forEach(function (f) { html += rowHtml(f); });
          if (!arr.length) html = '<div class="empty">Ничего не найдено</div>';
          listEl.innerHTML = html;
        }
        function total() {
          var n = DB.dayNutrition(date).totals;
          U.$('#fp-total', el).textContent = 'Сегодня: ' + n.kcal + ' ккал · Б ' + Math.round(n.p) + ' · Ж ' + Math.round(n.f) + ' · У ' + Math.round(n.c);
        }
        renderList(); total();
        U.$('#fp-q', el).addEventListener('input', renderList);
        listEl.addEventListener('click', function (e) {
          var ed = e.target.closest('[data-fpedit]');
          if (ed) { e.stopPropagation(); productModal(JSON.parse(JSON.stringify(DB.get('foods', ed.dataset.fpedit))), renderAll); return; }
          var row = e.target.closest('[data-fp]');
          if (!row) return;
          var f = DB.get('foods', row.dataset.fp); if (!f) return;
          amountModal(f, date, mealType, renderAll);
        });
        U.$('#fp-newp', el).onclick = function () {
          productModal(null, function (rec) {
            renderAll();
            if (rec) amountModal(rec, date, mealType, renderAll);
          });
        };
        U.$('#fp-newd', el).onclick = function () {
          dishModal(function (rec) {
            renderAll();
            if (rec) amountModal(rec, date, mealType, renderAll);
          });
        };
        U.$('#fp-done', el).onclick = function () { close(); App.render(); };
        function renderAll() { all.length = 0; DB.list('foods').forEach(function (f) { all.push(f); }); renderList(); total(); App.render(); }
      }
    });
  }

  /* ---------- создание/редактирование продукта ---------- */
  function productModal(existing, after) {
    var f = existing;
    App.modal({
      title: f ? 'Изменить продукт' : 'Новый продукт',
      body:
        '<label class="f"><span class="lb">Название</span><input type="text" id="np-n" value="' + (f ? esc(f.name) : '') + '" placeholder="напр. Творог 9%"></label>' +
        '<div class="f-3">' +
        '<label class="f"><span class="lb">Белки</span><input type="number" inputmode="decimal" step="0.1" id="np-p" value="' + (f ? f.protein : '') + '"></label>' +
        '<label class="f"><span class="lb">Жиры</span><input type="number" inputmode="decimal" step="0.1" id="np-f" value="' + (f ? f.fat : '') + '"></label>' +
        '<label class="f"><span class="lb">Углеводы</span><input type="number" inputmode="decimal" step="0.1" id="np-c" value="' + (f ? f.carbs : '') + '"></label></div>' +
        '<div class="micro muted" id="np-prev"></div>' +
        '<p class="micro muted" style="margin:4px 0 0">Значения на 100 г продукта</p>',
      footer: (f ? '<button class="btn danger" id="np-del" style="margin-bottom:8px">Удалить продукт</button>' : '') +
        '<div class="btnrow"><button class="btn" id="np-save">Сохранить</button></div>',
      onMount: function (el, close) {
        function prev() {
          var p = U.num(U.$('#np-p', el).value), ff = U.num(U.$('#np-f', el).value), c = U.num(U.$('#np-c', el).value);
          if (p == null && ff == null && c == null) { U.$('#np-prev', el).textContent = ''; return; }
          U.$('#np-prev', el).textContent = '≈ ' + DB.kcalOf(p || 0, ff || 0, c || 0) + ' ккал / 100 г';
        }
        ['np-p', 'np-f', 'np-c'].forEach(function (id) { U.$('#' + id, el).addEventListener('input', prev); });
        prev();
        U.$('#np-save', el).onclick = function () {
          var name = U.$('#np-n', el).value.trim();
          var p = U.num(U.$('#np-p', el).value), ff = U.num(U.$('#np-f', el).value), c = U.num(U.$('#np-c', el).value);
          if (!name) { App.toast('Введите название'); return; }
          if (p == null || ff == null || c == null || p < 0 || ff < 0 || c < 0) { App.toast('Заполните БЖУ'); return; }
          var patch = { name: name, protein: p, fat: ff, carbs: c, kcal: DB.kcalOf(p, ff, c), is_dish: false };
          var rec;
          if (f) { rec = DB.update('foods', f.id, patch); }
          else { rec = DB.insert('foods', Object.assign({ usage: 0 }, patch)); }
          close();
          App.toast(f ? 'Продукт обновлён' : 'Продукт «' + name + '» создан', true);
          after(rec);
        };
        var del = U.$('#np-del', el);
        if (del) del.onclick = function () {
          App.confirm({
            title: 'Удалить продукт?', message: '«' + f.name + '» исчезнет из каталога. Записи в дневнике останутся с пересчётом.', danger: true, okText: 'Удалить',
            onOk: function () { DB.remove('foods', f.id); close(); App.toast('Продукт удалён'); after(null); }
          });
        };
      }
    });
  }

  /* ---------- создание блюда ---------- */
  function dishModal(after) {
    var components = [];
    App.modal({
      title: 'Новое блюдо',
      body:
        '<label class="f"><span class="lb">Название</span><input type="text" id="ds-n" placeholder="напр. Овсянка с бананом"></label>' +
        '<input type="text" id="ds-q" placeholder="Добавить продукт: введите название…" style="margin-bottom:8px">' +
        '<div id="ds-res"></div>' +
        '<div id="ds-comp" style="margin-top:8px"></div>' +
        '<div class="micro muted" id="ds-prev" style="margin-top:8px"></div>',
      footer: '<div class="btnrow"><button class="btn" id="ds-save">Сохранить блюдо</button></div>',
      onMount: function (el, close) {
        var resEl = U.$('#ds-res', el), compEl = U.$('#ds-comp', el);
        function renderComp() {
          if (!components.length) { compEl.innerHTML = '<div class="empty">Добавьте продукты из списка</div>'; }
          else compEl.innerHTML = components.map(function (c, i) {
            var f = DB.get('foods', c.food_id);
            return '<div class="fp-row"><div class="nm">' + (f ? esc(f.name) : '?') + '</div>' +
              '<input type="number" class="num" style="width:84px" inputmode="numeric" data-ci="' + i + '" value="' + c.grams + '">' +
              '<span class="micro muted">г</span><button class="edit" data-cx="' + i + '">✕</button></div>';
          }).join('');
          var per = DB.computeDishPer100(components);
          U.$('#ds-prev', el).textContent = components.length ?
            'На 100 г блюда: ' + DB.kcalOf(per.protein, per.fat, per.carbs) + ' ккал · ' + fmt(per.protein) + 'Б / ' + fmt(per.fat) + 'Ж / ' + fmt(per.carbs) + 'У' : '';
        }
        renderComp();
        U.$('#ds-q', el).addEventListener('input', function () {
          var q = this.value.trim().toLowerCase();
          if (!q) { resEl.innerHTML = ''; return; }
          var arr = DB.where('foods', function (f) { return !f.is_dish && f.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
          resEl.innerHTML = arr.map(function (f) {
            return '<div class="fp-row" data-ds="' + f.id + '"><div class="nm">' + esc(f.name) + '</div><div class="kb">+' + DB.foodKcal(f) + ' ккал/100г</div></div>';
          }).join('') || '<div class="micro muted" style="padding:4px 2px">Нет совпадений</div>';
        });
        resEl.addEventListener('click', function (e) {
          var row = e.target.closest('[data-ds]'); if (!row) return;
          components.push({ food_id: row.dataset.ds, grams: 100 });
          U.$('#ds-q', el).value = ''; resEl.innerHTML = '';
          renderComp();
        });
        compEl.addEventListener('input', function (e) {
          var inp = e.target.closest('[data-ci]'); if (!inp) return;
          var g = U.num(inp.value); if (g != null) components[+inp.dataset.ci].grams = g;
          var per = DB.computeDishPer100(components);
          U.$('#ds-prev', el).textContent = 'На 100 г блюда: ' + DB.kcalOf(per.protein, per.fat, per.carbs) + ' ккал · ' + fmt(per.protein) + 'Б / ' + fmt(per.fat) + 'Ж / ' + fmt(per.carbs) + 'У';
        });
        compEl.addEventListener('click', function (e) {
          var b = e.target.closest('[data-cx]'); if (!b) return;
          components.splice(+b.dataset.cx, 1); renderComp();
        });
        U.$('#ds-save', el).onclick = function () {
          var name = U.$('#ds-n', el).value.trim();
          if (!name) { App.toast('Введите название блюда'); return; }
          if (!components.length) { App.toast('Добавьте хотя бы один продукт'); return; }
          var per = DB.computeDishPer100(components);
          var rec = DB.insert('foods', {
            name: name, protein: per.protein, fat: per.fat, carbs: per.carbs,
            kcal: DB.kcalOf(per.protein, per.fat, per.carbs), is_dish: true,
            recipe: components.slice(), usage: 0
          });
          close(); App.toast('Блюдо «' + name + '» создано', true);
          after(rec);
        };
      }
    });
  }

  /* ---------- рендер одного дня (сегодня или архивный) ---------- */
  function renderDayInto(sel, date, opts) {
    opts = opts || {};
    var goal = DB.get('goals', 'main');
    var day = DB.dayNutrition(date);
    var root = U.$(sel);
    var html = '';

    html += '<div class="card"><div class="row"><div class="grow">' +
      '<div class="big">' + day.totals.kcal + '<span class="tiny muted"> / ' + goal.kcal + ' ккал</span></div>' +
      '<div class="pbar ' + (day.totals.kcal > goal.kcal ? 'over' : '') + '"><i style="width:' + Math.min(100, day.totals.kcal / goal.kcal * 100) + '%"></i></div>' +
      '</div></div>' +
      '<div class="macro-row">' +
      macro('Б', day.totals.p, goal.protein, 'p') + macro('Ж', day.totals.f, goal.fat, 'f') + macro('У', day.totals.c, goal.carbs, 'c') +
      '</div></div>';

    function macro(lb, val, max, cls) {
      return '<div class="macro ' + cls + '"><div class="lb"><span>' + lb + '</span><span>' + Math.round(val) + '/' + max + '</span></div>' +
        '<div class="pbar"><i style="width:' + Math.min(100, max ? val / max * 100 : 0) + '%"></i></div></div>';
    }

    if (opts.showCopy) {
      var yest = U.addDays(date, -1);
      var yn = DB.dayNutrition(yest);
      if (yn.itemCount) {
        html += '<button class="btn sec" style="margin-bottom:12px" data-action="copyYesterday" data-date="' + date + '">📋 Скопировать питание за ' + U.dateRu(yest) + ' (' + yn.itemCount + ' поз. · ' + yn.totals.kcal + ' ккал)</button>';
      }
    }

    var mealsByType = {};
    day.meals.forEach(function (m) { mealsByType[m.meal.type] = m; });

    App.MEAL_TYPES.forEach(function (mt) {
      var m = mealsByType[mt.id];
      html += '<div class="meal"><div class="meal-h">' +
        '<span>' + mt.icon + '</span><span class="nm">' + mt.name + '</span>' +
        (m ? '<span class="kc">' + m.totals.kcal + ' ккал</span>' + (opts.deletable ? '<button class="edit" style="color:var(--txt3)" data-action="delMeal" data-mid="' + m.meal.id + '">✕</button>' : '') : '') +
        '</div>';
      if (m) {
        var items = DB.itemsOfMeal(m.meal.id);
        if (items.length) {
          html += items.map(function (it) {
            var f = DB.get('foods', it.food_id); if (!f) return '';
            var n = DB.itemNutr(it, f);
            return '<div class="lrow" style="border:none;border-bottom:1px solid var(--line);border-radius:0;margin:0" data-action="editItem" data-iid="' + it.id + '">' +
              '<div class="grow"><div class="t" style="font-weight:500">' + foodLabel(f) + '</div>' +
              '<div class="s">' + it.grams + ' г · ' + Math.round(n.kcal) + ' ккал · Б' + fmt(n.p) + ' Ж' + fmt(n.f) + ' У' + fmt(n.c) + '</div></div>' +
              '<span class="chev">›</span></div>';
          }).join('');
        } else html += '<div class="meal-empty">Пусто</div>';
      } else html += '<div class="meal-empty">Пусто</div>';
      html += '<button class="meal-add" data-action="addFood" data-date="' + date + '" data-mt="' + mt.id + '">＋ Добавить в «' + mt.name + '»</button></div>';
    });

    root.innerHTML = html;
  }

  App.renderFoodDay = renderDayInto;

  /* ---------- экран «Питание» ---------- */
  App.screens.food = function () {
    var t = U.todayStr();
    var root = U.$('#screen');
    root.innerHTML = '<h2 class="sec" style="margin-top:2px">Сегодня, ' + U.dateRu(t) + '</h2><div id="food-day"></div>';
    renderDayInto('#food-day', t, { showCopy: true, deletable: true });
  };

  /* ---------- detail-вьюха дня (из истории) ---------- */
  App.views.dayFood = function (date) {
    return {
      title: 'Питание — ' + U.dateRu(date),
      render: function () {
        var root = U.$('#screen');
        var t = U.todayStr();
        root.innerHTML = (date !== t ? '<button class="btn sec" style="margin-bottom:12px" data-action="copyDayToToday" data-date="' + date + '">📋 Скопировать этот день на сегодня</button>' : '') +
          '<div id="food-day"></div>';
        renderDayInto('#food-day', date, { deletable: true });
      }
    };
  };

  /* ---------- действия ---------- */
  App.actions.addFood = function (d) { foodPicker(d.date, d.mt); };
  App.actions.editItem = function (d) { App.modals.mealItem(d.iid); };
  App.actions.delMeal = function (d) {
    var meal = DB.get('meals', d.mid); if (!meal) return;
    App.confirm({
      title: 'Удалить приём пищи?', message: 'Все позиции из «' + mealName(meal.type).name + '» за ' + U.dateRu(meal.date) + ' будут удалены.', danger: true, okText: 'Удалить',
      onOk: function () {
        DB.removeWhere('meal_items', function (it) { return it.meal_id === meal.id; });
        DB.remove('meals', meal.id);
        App.render(); App.toast('Приём пищи удалён');
      }
    });
  };
  App.actions.copyYesterday = function (d) {
    var date = d.date, yest = U.addDays(date, -1);
    var cur = DB.dayNutrition(date);
    function doCopy() {
      var n = DB.copyDayNutrition(yest, date);
      App.toast('Скопировано позиций: ' + n + '. Коснитесь продукта, чтобы изменить вес.', true);
      App.render();
    }
    if (cur.itemCount > 0) {
      App.confirm({
        title: 'Добавить к текущим записям?', message: 'За ' + U.dateRu(date) + ' уже есть ' + cur.itemCount + ' позиций. Вчерашние будут добавлены к ним.', okText: 'Добавить',
        onOk: doCopy
      });
    } else doCopy();
  };
  App.actions.copyDayToToday = function (d) {
    var t = U.todayStr();
    var n = DB.copyDayNutrition(d.date, t);
    App.toast(n ? 'Скопировано позиций: ' + n + ' на сегодня' : 'В этом дне нет записей', !!n);
    if (n) App.go('food');
  };
})();
