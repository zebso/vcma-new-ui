// ===== Dev: 改行で複数ユーザー追加 =====

// テキストエリアからID一覧を取得（空行スキップ）
function collectUserIdsFromTextarea() {
  var textarea = document.getElementById('new-user-id-dev');
  if (!textarea) return [];

  var lines = textarea.value.split(/\r?\n/);
  var ids = lines.map(function(line) { return line.trim(); }).filter(function(v) { return v.length > 0; });

  // 重複除外
  var unique = [];
  var seen = {};
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (!seen[id]) {
      seen[id] = true;
      unique.push(id);
    }
  }

  var removed = ids.length - unique.length;
  return unique;
}

function handleBulkCreateUsersDev() {
  var initialInput = document.getElementById('initial-balance-dev');
  var initialBalance = parseInt(initialInput && initialInput.value) || 0;

  var ids = collectUserIdsFromTextarea();
  if (ids.length === 0) {
    showNotification('ユーザーIDを1つ以上入力してください', 'error');
    return;
  }

  showLoading(true);

  var tasks = ids.map(function(id) {
    return createUser(id, initialBalance)
      .then(function() { return { id: id, ok: true }; })
      .catch(function() { return { id: id, ok: false }; });
  });

  Promise.all(tasks)
    .then(function(results) {
      var ok = results.filter(function(r) { return r.ok; });
      var ng = results.filter(function(r) { return !r.ok; });

      // 成功・失敗を個別通知（ずらして表示）
      var delay = 1000;

      // if (ok.length) {
      //   delay += ok.length * 300 + 400;
      // }

      // if (ng.length) {
      //   delay += ng.length * 300 + 400;
      // }

      // 最後にまとめ通知
      setTimeout(function() {
        showNotification(
          '完了: 成功 ' + ok.length + ' 件 / 失敗 ' + ng.length + ' 件',
          ng.length > 0 ? 'error' : 'info'
        );
      }, delay + 300);

      // UI更新を遅延して自然に
      setTimeout(function() {
        loadRanking();
        loadDashboard();
      }, delay + 1000);
    })
    .finally(function() {
      showLoading(false);
    });
}

// ===== 初期化にイベントを追加 =====
document.addEventListener('DOMContentLoaded', function () {
  var devBtn = document.getElementById('create-user-btn-dev');
  if (devBtn) {
    devBtn.addEventListener('click', handleBulkCreateUsersDev);
  }
});

// ===== CSSテスター: ページ全体へ適用 =====
var DEV_CSS_KEY = 'devLiveCss';

function ensureDevStyleTag() {
  var styleEl = document.getElementById('dev-live-css');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dev-live-css';
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

function applyDevCss(cssText) {
  var styleEl = ensureDevStyleTag();
  // そのまま流し込む（<style>なのでJSは実行されない）
  styleEl.textContent = cssText || '';
}

function initCssTester() {
  var textarea = document.getElementById('css-dev');
  if (!textarea) return;

  // 保存済みCSSがあれば復元＆適用
  var saved = localStorage.getItem(DEV_CSS_KEY) || '';
  if (saved) {
    textarea.value = saved;
    applyDevCss(saved);
  }

  // 入力のたびに即時適用（負荷を下げたい場合は debounce 推奨）
  var t;
  textarea.addEventListener('input', function(e) {
    var val = e.target.value;
    clearTimeout(t);
    t = setTimeout(function() {
      applyDevCss(val);
      localStorage.setItem(DEV_CSS_KEY, val);
    }, 150); // 軽めのデバウンス
  });

  // Ctrl/Cmd + Enter でも適用
  textarea.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      applyDevCss(textarea.value);
      localStorage.setItem(DEV_CSS_KEY, textarea.value);
      showNotification('CSSを適用しました');
    }
  });
}

// クリア関数（任意：リセットUIから呼ぶ）
function resetDevCss() {
  var textarea = document.getElementById('css-dev');
  if (textarea) textarea.value = '';
  applyDevCss('');
  localStorage.removeItem(DEV_CSS_KEY);
  showNotification('CSSをリセットしました');
}

document.addEventListener('DOMContentLoaded', function() {
  initCssTester();
});