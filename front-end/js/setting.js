// --- 開発タブ表示設定 ---
function initDevTabToggle() {
  const devTab = document.getElementById('dev-menu');
  const toggle = document.getElementById('dev-tab-toggle');

  if (!devTab || !toggle) return;

  // 保存された設定を読み込み
  const isDevVisible = localStorage.getItem('showDevTab') === 'true';
  devTab.style.display = isDevVisible ? '' : 'none';
  toggle.checked = isDevVisible;

  // スイッチ操作で切り替え
  toggle.addEventListener('change', (e) => {
    const show = e.target.checked;
    devTab.style.display = show ? '' : 'none';
    localStorage.setItem('showDevTab', show);
    showNotification(show ? '開発タブを表示しました' : '開発タブを非表示にしました');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initDevTabToggle();
});

// === Theme system ===
const THEME_KEY = 'theme';

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);

  // UI反映
  const select = document.getElementById('theme-select');
  if (select) select.value = savedTheme;

  // イベント設定
  if (select) {
    select.addEventListener('change', (e) => {
      const theme = e.target.value;
      applyTheme(theme);
      localStorage.setItem(THEME_KEY, theme);
      showNotification(`${themeLabel(theme)} テーマを適用しました`);
    });
  }
}

// テーマ適用処理
function applyTheme(theme) {
  document.body.classList.remove('light-theme', 'dark-mode', 'sepia-mode');
  document.body.classList.add(`${theme}-mode`);
}

// テーマ名を日本語で表示
function themeLabel(theme) {
  switch (theme) {
    case 'dark': return 'ダーク';
    case 'sepia': return 'セピア';
    default: return 'ライト';
  }
}

// ページ読込時に初期化
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
});


// --- Default Tab Preference -----------------------------

const TAB_KEYS = ["dashboard", "balance", "ranking", "history", "settings"];
const DEFAULT_TAB_KEY = "defaultTab";

/** nav の該当タブ要素を取得（onclick 引数から推定） */
function findNavItem(tab) {
  const items = Array.from(document.querySelectorAll("nav .nav-item"));
  return items.find((el) => {
    const onclick = el.getAttribute("onclick") || "";
    return onclick.includes(`'${tab}'`);
  }) || items[0];
}

/** 設定UIと保存ロジック */
function setupDefaultTabSelector() {
  const select = document.getElementById("default-tab-select");
  if (!select) return;

  const saved = localStorage.getItem(DEFAULT_TAB_KEY) || "dashboard";
  if (TAB_KEYS.includes(saved)) select.value = saved;

  select.addEventListener("change", (e) => {
    const val = e.target.value;
    if (TAB_KEYS.includes(val)) {
      localStorage.setItem(DEFAULT_TAB_KEY, val);
    }
  });
}

/** 起動時にデフォルトタブを nav-item のクリックで開く */
function applyDefaultTabOnLoad() {
  let saved = localStorage.getItem(DEFAULT_TAB_KEY);
  if (!TAB_KEYS.includes(saved)) {
    saved = "dashboard";
    localStorage.setItem(DEFAULT_TAB_KEY, saved);
  }
  const navItem = findNavItem(saved);
  // 重要：switchTab は直接呼ばず、下メニューを「クリック」して切替
  // 初期化との競合を避けるため、描画後のタイミングで実行
  requestAnimationFrame(() => {
    navItem?.click();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupDefaultTabSelector();
  applyDefaultTabOnLoad();
});