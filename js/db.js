/* ============================================================
   FitTrack — слой данных (localStorage, разделение сущностей)
   История тренировок хранится в снапшотах: изменение шаблона
   не перезаписывает прошлые сессии.
   ============================================================ */
(function () {
  'use strict';
  var P = 'ft_';
  var COLLS = ['users', 'goals', 'daily_checkins', 'body_measurements', 'foods',
    'meals', 'meal_items', 'exercises', 'workout_templates', 'workout_sessions',
    'workout_sets', 'cardio_sessions', 'daily_activity', 'supplements', 'progress_photos'];

  function uid() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function load(c) { try { return JSON.parse(localStorage.getItem(P + c)) || []; } catch (e) { return []; } }
  function save(c, rows) { localStorage.setItem(P + c, JSON.stringify(rows)); }

  var DB = {
    COLLLECTIONS: COLLS,
    list: function (c) { return load(c); },
    get: function (c, id) { return load(c).find(function (r) { return r.id === id; }) || null; },
    where: function (c, fn) { return load(c).filter(fn); },
    getWhere: function (c, fn) { return load(c).find(fn) || null; },
    insert: function (c, rec) {
      var rows = load(c);
      var r = Object.assign({ id: uid(), created_at: new Date().toISOString() }, rec);
      rows.push(r); save(c, rows); return r;
    },
    update: function (c, id, patch) {
      var rows = load(c); var i = rows.findIndex(function (r) { return r.id === id; });
      if (i < 0) return null;
      rows[i] = Object.assign({}, rows[i], patch, { updated_at: new Date().toISOString() });
      save(c, rows); return rows[i];
    },
    upsert: function (c, matchFn, patch) {
      var rows = load(c); var i = rows.findIndex(matchFn);
      if (i >= 0) {
        rows[i] = Object.assign({}, rows[i], patch, { updated_at: new Date().toISOString() });
        save(c, rows); return rows[i];
      }
      var rec = Object.assign({ id: uid(), created_at: new Date().toISOString() }, patch);
      rows.push(rec); save(c, rows); return rec;
    },
    remove: function (c, id) { save(c, load(c).filter(function (r) { return r.id !== id; })); },
    removeWhere: function (c, fn) { save(c, load(c).filter(function (r) { return !fn(r); })); },
    clearAll: function () {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(P) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    },
    exportAll: function () { var o = {}; COLLS.forEach(function (c) { o[c] = load(c); }); return o; },
    importAll: function (obj) {
      COLLS.forEach(function (c) { if (Array.isArray(obj[c])) save(c, obj[c]); });
    }
  };

  /* ---------- питание ---------- */
  function kcalOf(p, f, c) { return Math.round(p * 4 + c * 4 + f * 9); }
  function foodKcal(food) { return food.kcal || kcalOf(food.protein, food.fat, food.carbs); }
  function itemNutr(item, food) {
    var k = item.grams / 100;
    return { p: food.protein * k, f: food.fat * k, c: food.carbs * k, kcal: foodKcal(food) * k };
  }
  function computeDishPer100(recipe) {
    var p = 0, f = 0, c = 0, g = 0;
    (recipe || []).forEach(function (rc) {
      var fd = DB.get('foods', rc.food_id); if (!fd) return;
      g += rc.grams;
      p += fd.protein * rc.grams / 100; f += fd.fat * rc.grams / 100; c += fd.carbs * rc.grams / 100;
    });
    if (!g) return { protein: 0, fat: 0, carbs: 0, kcal: 0 };
    var per = { protein: p / g * 100, fat: f / g * 100, carbs: c / g * 100 };
    per.kcal = kcalOf(per.protein, per.fat, per.carbs);
    return per;
  }
  function mealsOf(date) { return DB.where('meals', function (m) { return m.date === date; }); }
  function itemsOfMeal(mealId) {
    return DB.where('meal_items', function (it) { return it.meal_id === mealId; })
      .sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
  }
  function dayNutrition(date) {
    var totals = { kcal: 0, p: 0, f: 0, c: 0 };
    var meals = [];
    var count = 0;
    mealsOf(date).forEach(function (m) {
      var mt = { kcal: 0, p: 0, f: 0, c: 0 };
      itemsOfMeal(m.id).forEach(function (it) {
        var fd = DB.get('foods', it.food_id); if (!fd) return;
        var n = itemNutr(it, fd);
        mt.kcal += n.kcal; mt.p += n.p; mt.f += n.f; mt.c += n.c;
        count++;
      });
      mt.kcal = Math.round(mt.kcal);
      meals.push({ meal: m, totals: mt });
      totals.kcal += mt.kcal; totals.p += mt.p; totals.f += mt.f; totals.c += mt.c;
    });
    totals.kcal = Math.round(totals.kcal);
    return { totals: totals, meals: meals, itemCount: count };
  }
  function copyDayNutrition(fromDate, toDate) {
    var n = 0;
    mealsOf(fromDate).forEach(function (src) {
      var items = itemsOfMeal(src.id);
      if (!items.length) return;
      var dst = DB.upsert('meals', function (m) { return m.date === toDate && m.type === src.type; },
        { date: toDate, type: src.type });
      items.forEach(function (it) {
        DB.insert('meal_items', { meal_id: dst.id, food_id: it.food_id, grams: it.grams });
        n++;
      });
    });
    return n;
  }

  /* ---------- тренировки ---------- */
  function sessionsDone() {
    return DB.where('workout_sessions', function (s) { return s.status === 'done'; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.created_at < b.created_at ? 1 : -1;
      });
  }
  function setsOfSession(sid) {
    return DB.where('workout_sets', function (r) { return r.session_id === sid; })
      .sort(function (a, b) {
        if (a.exercise_id !== b.exercise_id) return a.exercise_id < b.exercise_id ? -1 : 1;
        return a.set_no - b.set_no;
      });
  }
  function setsOfExerciseInSession(sid, exId) {
    return DB.where('workout_sets', function (r) { return r.session_id === sid && r.exercise_id === exId; })
      .sort(function (a, b) { return a.set_no - b.set_no; });
  }
  function lastSetsForExercise(exId, beforeSessionId) {
    var slist = sessionsDone();
    if (beforeSessionId) {
      var idx = slist.findIndex(function (s) { return s.id === beforeSessionId; });
      if (idx >= 0) slist = slist.slice(idx + 1);
    }
    for (var i = 0; i < slist.length; i++) {
      var sets = setsOfExerciseInSession(slist[i].id, exId);
      if (sets.length) return { session: slist[i], sets: sets };
    }
    return null;
  }
  function roundW(x) { return Math.round(x * 4) / 4; }
  /* Прогрессия: если во всех плановых подходах достигнута верхняя
     граница повторений — предлагаем +step кг, иначе тот же вес. */
  function suggestionFor(item, last) {
    if (!last || !last.sets.length) return null;
    var step = item.step_kg || 0;
    var top = Math.max.apply(null, last.sets.map(function (s) { return s.weight_kg; }));
    var planned = Math.max(item.sets || 1, last.sets.length);
    var allMax = last.sets.length >= planned &&
      last.sets.every(function (s) { return s.reps >= (item.rep_max || item.rep_min); });
    if (step > 0) {
      return { allMax: allMax, top: top, step: step, weight: roundW(allMax ? top + step : top) };
    }
    /* упражнения с весом тела: прогрессируем повторами */
    return { allMax: allMax, top: top, step: 0, weight: top, repsPlus: allMax ? 2 : 0 };
  }
  function sessionVolume(sid) {
    return setsOfSession(sid).reduce(function (acc, s) { return acc + s.weight_kg * s.reps; }, 0);
  }
  function createSessionFromTemplate(tpl) {
    var items = (tpl.items || []).map(function (it) {
      var snap = {
        exercise_id: it.exercise_id, name: it.name, sets: it.sets,
        rep_min: it.rep_min, rep_max: it.rep_max, step_kg: it.step_kg
      };
      var last = lastSetsForExercise(it.exercise_id);
      var sug = suggestionFor(snap, last);
      snap.suggest = sug ? sug.weight : null;
      return snap;
    });
    return DB.insert('workout_sessions', {
      date: dstrLocal(), template_id: tpl.id, template_name: tpl.name,
      status: 'active', started_at: new Date().toISOString(), items: items
    });
  }
  function dstrLocal() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
  }

  /* ---------- сиды первого запуска ---------- */
  var FOOD_SEED = [
    ['Куриная грудка', 23.6, 1.9, 0.4], ['Куриное бедро', 19, 9, 0],
    ['Говядина нежирная', 20, 10, 0], ['Индейка, филе', 22, 3, 0],
    ['Лосось', 20, 13, 0], ['Тунец в собственном соку', 23, 1, 0],
    ['Яйцо куриное', 12.7, 11.5, 0.7], ['Творог 5%', 17, 5, 3],
    ['Творог 0%', 18, 0.6, 3.3], ['Молоко 2.5%', 2.9, 2.5, 4.7],
    ['Кефир 1%', 3, 1, 4], ['Греческий йогурт 2%', 8, 2, 4],
    ['Сыр твёрдый', 25, 30, 0], ['Овсяные хлопья (сухие)', 12, 6, 60],
    ['Рис белый (сухой)', 7, 1, 78], ['Гречка (сухая)', 12, 3, 68],
    ['Макароны (сухие)', 11, 1.5, 72], ['Хлеб цельнозерновой', 9, 3, 45],
    ['Картофель', 2, 0.4, 17], ['Банан', 1.5, 0.2, 21],
    ['Яблоко', 0.4, 0.4, 10], ['Помидор', 1, 0.2, 4], ['Огурец', 0.8, 0.1, 2],
    ['Грецкие орехи', 15, 65, 14], ['Арахисовая паста', 25, 50, 10],
    ['Оливковое масло', 0, 100, 0], ['Сливочное масло 82%', 0.8, 82, 0.8],
    ['Сывороточный протеин', 75, 6, 8], ['Шоколад тёмный', 8, 35, 48],
    ['Мёд', 0.3, 0, 80]
  ];
  var EX_SEED = [
    ['Приседания со штангой', 'Ноги'], ['Жим лёжа', 'Грудь'], ['Жим стоя', 'Плечи'],
    ['Тяга штанги в наклоне', 'Спина'], ['Становая тяга', 'Спина'], ['Подтягивания', 'Спина'],
    ['Тяга верхнего блока', 'Спина'], ['Жим гантелей сидя', 'Плечи'], ['Жим гантелей лёжа', 'Грудь'],
    ['Разведение гантелей', 'Грудь'], ['Жим ногами', 'Ноги'], ['Румынская тяга', 'Ноги'],
    ['Выпады', 'Ноги'], ['Икры стоя', 'Ноги'], ['Отжимания', 'Грудь'],
    ['Бицепс со штангой', 'Руки'], ['Молотки с гантелями', 'Руки'],
    ['Трицепс на блоке', 'Руки'], ['Французский жим', 'Руки'],
    ['Скручивания', 'Пресс'], ['Планка', 'Пресс'], ['Приседания без веса', 'Ноги'],
    ['Бег', 'Кардио'], ['Ходьба', 'Кардио']
  ];

  function seed() {
    if (DB.list('users').length) return;
    DB.insert('users', { id: 'local', name: '' });
    DB.insert('goals', {
      id: 'main', kcal: 2400, protein: 160, fat: 75, carbs: 250, steps: 8000
    });
    FOOD_SEED.forEach(function (f) {
      DB.insert('foods', {
        name: f[0], protein: f[1], fat: f[2], carbs: f[3],
        kcal: kcalOf(f[1], f[2], f[3]), is_dish: false, usage: 0
      });
    });
    var exByName = {};
    EX_SEED.forEach(function (e) {
      var ex = DB.insert('exercises', { name: e[0], muscle: e[1], usage: 0 });
      exByName[e[0]] = ex.id;
    });
    DB.insert('workout_templates', {
      name: 'Фулбади',
      items: [
        { exercise_id: exByName['Приседания со штангой'], name: 'Приседания со штангой', sets: 3, rep_min: 8, rep_max: 12, step_kg: 2.5 },
        { exercise_id: exByName['Жим лёжа'], name: 'Жим лёжа', sets: 3, rep_min: 8, rep_max: 12, step_kg: 2.5 },
        { exercise_id: exByName['Тяга штанги в наклоне'], name: 'Тяга штанги в наклоне', sets: 3, rep_min: 8, rep_max: 12, step_kg: 2.5 },
        { exercise_id: exByName['Жим гантелей сидя'], name: 'Жим гантелей сидя', sets: 3, rep_min: 10, rep_max: 15, step_kg: 2 },
        { exercise_id: exByName['Бицепс со штангой'], name: 'Бицепс со штангой', sets: 2, rep_min: 10, rep_max: 15, step_kg: 1.25 },
        { exercise_id: exByName['Трицепс на блоке'], name: 'Трицепс на блоке', sets: 2, rep_min: 10, rep_max: 15, step_kg: 2.5 }
      ]
    });
    DB.insert('workout_templates', {
      name: 'Домашняя (без железа)',
      items: [
        { exercise_id: exByName['Отжимания'], name: 'Отжимания', sets: 4, rep_min: 10, rep_max: 20, step_kg: 0 },
        { exercise_id: exByName['Приседания без веса'], name: 'Приседания без веса', sets: 4, rep_min: 15, rep_max: 25, step_kg: 0 },
        { exercise_id: exByName['Планка'], name: 'Планка (сек)', sets: 3, rep_min: 40, rep_max: 90, step_kg: 0 }
      ]
    });
  }

  window.DB = DB;
  DB.kcalOf = kcalOf; DB.foodKcal = foodKcal; DB.itemNutr = itemNutr;
  DB.computeDishPer100 = computeDishPer100; DB.mealsOf = mealsOf; DB.itemsOfMeal = itemsOfMeal;
  DB.dayNutrition = dayNutrition; DB.copyDayNutrition = copyDayNutrition;
  DB.sessionsDone = sessionsDone; DB.setsOfSession = setsOfSession;
  DB.setsOfExerciseInSession = setsOfExerciseInSession; DB.lastSetsForExercise = lastSetsForExercise;
  DB.suggestionFor = suggestionFor; DB.sessionVolume = sessionVolume;
  DB.createSessionFromTemplate = createSessionFromTemplate; DB.seed = seed; DB.roundW = roundW;
})();
