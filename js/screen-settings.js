/* ============================================================
   Настройки: профиль, цели, добавки, экспорт/импорт/сброс.
   ============================================================ */
(function () {
  'use strict';
  var U = App.U, esc = U.esc;

  App.views.settings = function () {
    return {
      title: 'Настройки',
      render: function () {
        var user = DB.getWhere('users', function () { return true; }) || {};
        var goal = DB.get('goals', 'main') || {};
        var sups = DB.list('supplements');

        function inp(id, lb, val, ph, type) {
          return '<label class="f"><span class="lb">' + lb + '</span>' +
            '<input type="' + (type || 'number') + '" inputmode="decimal" id="' + id + '" value="' + (val != null ? val : '') + '" placeholder="' + ph + '"></label>';
        }

        var html = '<div class="card">' +
          '<h2 class="sec" style="margin:2px 0 10px">Профиль</h2>' +
          inp('st-name', 'Имя', esc(user.name || ''), 'Как вас зовут', 'text') +
          '</div>';

        html += '<div class="card">' +
          '<h2 class="sec" style="margin:2px 0 10px">Цели на день</h2>' +
          '<div class="f-2">' +
          inp('st-kcal', 'Калории, ккал', goal.kcal, 2400) +
          inp('st-steps', 'Шаги', goal.steps, 8000) +
          '</div><div class="f-3">' +
          inp('st-p', 'Белки, г', goal.protein, 160) +
          inp('st-f', 'Жиры, г', goal.fat, 75) +
          inp('st-c', 'Углеводы, г', goal.carbs, 250) +
          '</div><button class="btn" id="st-save">Сохранить цели</button></div>';

        html += '<div class="card">' +
          '<h2 class="sec" style="margin:2px 0 10px">Добавки</h2>' +
          '<p class="micro muted" style="margin:0 0 10px">Отметки о приёме на главном экране</p>' +
          (sups.length ? sups.map(function (s) {
            return '<div class="lrow" style="cursor:default"><div class="grow"><div class="t">' + esc(s.name) + '</div>' +
              '<div class="s">принято ' + (s.taken || []).length + ' раз</div></div>' +
              '<button class="edit" data-action="delSup" data-sid="' + s.id + '" style="color:var(--red);font-size:15px;background:none;border:none;padding:8px">✕</button></div>';
          }).join('') : '<div class="empty" style="padding:8px">Список пуст</div>') +
          '<div class="row" style="margin-top:8px"><input type="text" id="st-sup" placeholder="Витамин D, креатин…" style="flex:1">' +
          '<button class="btn sm" data-action="addSup">＋</button></div></div>';

        html += '<div class="card">' +
          '<h2 class="sec" style="margin:2px 0 10px">Данные</h2>' +
          '<p class="micro muted" style="margin:0 0 10px">Все данные хранятся только на этом устройстве (офлайн). Сделайте резервную копию, чтобы не потерять историю.</p>' +
          '<div class="btnrow"><button class="btn sec" data-action="exportData">⬇ Экспорт</button>' +
          '<button class="btn sec" data-action="importData">⬆ Импорт</button></div>' +
          '<button class="btn danger" style="margin-top:8px" data-action="resetData">Сбросить все данные</button>' +
          '<input type="file" id="st-file" accept="application/json" hidden>' +
          '</div>';

        html += '<div class="micro muted" style="text-align:center;margin:16px 0 4px">FitTrack · офлайн-дневник веса, питания и тренировок</div>';

        U.$('#screen').innerHTML = html;

        U.$('#st-save').onclick = function () {
          var name = U.$('#st-name').value.trim();
          if (user.id) DB.update('users', user.id, { name: name });
          var g = {
            kcal: U.num(U.$('#st-kcal').value) || 2400,
            steps: U.num(U.$('#st-steps').value) || 8000,
            protein: U.num(U.$('#st-p').value) || 0,
            fat: U.num(U.$('#st-f').value) || 0,
            carbs: U.num(U.$('#st-c').value) || 0
          };
          DB.upsert('goals', function (r) { return r.id === 'main' || true; }, Object.assign({ id: 'main' }, g));
          App.toast('Настройки сохранены', true);
        };

        var fileInp = U.$('#st-file');
        fileInp.onchange = function () {
          var file = fileInp.files && fileInp.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            var data;
            try { data = JSON.parse(reader.result); } catch (e) { App.toast('Файл повреждён'); return; }
            if (!data || !Array.isArray(data.daily_checkins) && !Array.isArray(data.foods)) { App.toast('Это не резервная копия FitTrack'); return; }
            App.confirm({
              title: 'Импортировать данные?', message: 'Текущие данные будут полностью заменены содержимым файла.', danger: true, okText: 'Импортировать',
              onOk: function () {
                DB.clearAll(); DB.importAll(data); App.toast('Данные импортированы', true); App.go('dashboard');
              }
            });
          };
          reader.readAsText(file);
        };
      }
    };
  };

  App.actions.addSup = function () {
    var inp = App.U.$('#st-sup');
    var name = inp.value.trim();
    if (!name) { App.toast('Введите название добавки'); return; }
    DB.insert('supplements', { name: name, taken: [] });
    App.render();
  };
  App.actions.delSup = function (d) {
    DB.remove('supplements', d.sid);
    App.render();
  };
  App.actions.exportData = function () {
    var data = DB.exportAll();
    var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    var t = U.todayStr();
    a.download = 'fittrack-backup-' + t + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    App.toast('Резервная копия скачана', true);
  };
  App.actions.importData = function () {
    var inp = U.$('#st-file');
    if (inp) inp.click();
  };
  App.actions.resetData = function () {
    App.confirm({
      title: 'Удалить ВСЕ данные?', message: 'Вес, питание, тренировки, замеры, фото и история будут удалены безвозвратно. Сначала сделайте экспорт, если данные нужны.', danger: true, okText: 'Удалить всё',
      onOk: function () {
        App.confirm({
          title: 'Точно?', message: 'Последнее подтверждение — отменить будет нельзя.', danger: true, okText: 'Да, удалить всё',
          onOk: function () {
            DB.clearAll(); DB.seed();
            App.toast('Все данные удалены');
            App.go('dashboard');
          }
        });
      }
    });
  };
})();
