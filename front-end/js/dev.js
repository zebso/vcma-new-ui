// ===== Dev: 改行で複数ユーザー追加 =====

// テキストエリアからID一覧を取得（空行スキップ）
function collectUserIdsFromTextarea() {
  const textarea = document.getElementById('new-user-id-dev');
  if (!textarea) return [];

  const lines = textarea.value.split(/\r?\n/);
  const ids = lines.map(line => line.trim()).filter(v => v.length > 0);

  // 重複除外
  const unique = [];
  const seen = new Set();
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }

  const removed = ids.length - unique.length;
  return unique;
}

async function handleBulkCreateUsersDev() {
  const initialInput = document.getElementById('initial-balance-dev');
  const initialBalance = parseInt(initialInput?.value) || 0;

  const ids = collectUserIdsFromTextarea();
  if (ids.length === 0) {
    showNotification('ユーザーIDを1つ以上入力してください', 'error');
    return;
  }

  showLoading(true);

  try {
    const tasks = ids.map(id =>
      createUser(id, initialBalance)
        .then(() => ({ id, ok: true }))
        .catch(() => ({ id, ok: false }))
    );

    const results = await Promise.all(tasks);
    const ok = results.filter(r => r.ok);
    const ng = results.filter(r => !r.ok);

    // 成功・失敗を個別通知（ずらして表示）
    let delay = 3500;

    if (ok.length) {
      delay += ok.length * 300 + 400;
    }

    if (ng.length) {
      delay += ng.length * 300 + 400;
    }

    // 最後にまとめ通知
    setTimeout(() => {
      showNotification(
        `完了: 成功 ${ok.length} 件 / 失敗 ${ng.length} 件`,
        ng.length > 0 ? 'error' : 'info'
      );
    }, delay + 300);

    // UI更新を遅延して自然に
    setTimeout(() => {
      loadRanking();
      loadDashboard();
    }, delay + 3500);

  } finally {
    showLoading(false);
  }
}

// ===== 初期化にイベントを追加 =====
document.addEventListener('DOMContentLoaded', function () {
  const devBtn = document.getElementById('create-user-btn-dev');
  if (devBtn) {
    devBtn.addEventListener('click', handleBulkCreateUsersDev);
  }
});

// ===== CSSテスター: ページ全体へ適用 =====
const DEV_CSS_KEY = 'devLiveCss';

function ensureDevStyleTag() {
  let styleEl = document.getElementById('dev-live-css');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dev-live-css';
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

function applyDevCss(cssText) {
  const styleEl = ensureDevStyleTag();
  // そのまま流し込む（<style>なのでJSは実行されない）
  styleEl.textContent = cssText || '';
}

function initCssTester() {
  const textarea = document.getElementById('css-dev');
  if (!textarea) return;

  // 保存済みCSSがあれば復元＆適用
  const saved = localStorage.getItem(DEV_CSS_KEY) || '';
  if (saved) {
    textarea.value = saved;
    applyDevCss(saved);
  }

  // 入力のたびに即時適用（負荷を下げたい場合は debounce 推奨）
  let t;
  textarea.addEventListener('input', (e) => {
    const val = e.target.value;
    clearTimeout(t);
    t = setTimeout(() => {
      applyDevCss(val);
      localStorage.setItem(DEV_CSS_KEY, val);
    }, 150); // 軽めのデバウンス
  });

  // Ctrl/Cmd + Enter でも適用
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      applyDevCss(textarea.value);
      localStorage.setItem(DEV_CSS_KEY, textarea.value);
      showNotification('CSSを適用しました');
    }
  });
}

// クリア関数（任意：リセットUIから呼ぶ）
function resetDevCss() {
  const textarea = document.getElementById('css-dev');
  if (textarea) textarea.value = '';
  applyDevCss('');
  localStorage.removeItem(DEV_CSS_KEY);
  showNotification('CSSをリセットしました');
}

document.addEventListener('DOMContentLoaded', () => {
  initCssTester();
});