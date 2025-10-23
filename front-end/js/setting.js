// --- 開発タブ表示設定 ---
function initDevTabToggle() {
  const devTab = document.getElementById('dev-menu');
  const toggle = document.getElementById('dev-tab-toggle');

  if (!devTab || !toggle) return;

  // 保存された設定を読み込み
  const isDevVisible = localStorage.getItem('showDevTab') === 'true';
  devTab.style.display = isDevVisible ? '' : 'none';

  // 初期化時の表示変更を強制リフレッシュ（リフローハック）
  // 古いWebKitで display:none の反映が遅れるバグを回避
  devTab.offsetWidth;

  toggle.checked = isDevVisible;

  // スイッチ操作で切り替え
  toggle.addEventListener('change', (e) => {
    // 【iOS 12 修正】イベント処理の安定性を向上させるため setTimeout でラップ
    setTimeout(() => {
      // e.target.checked ではなく、toggle要素から直接状態を取得
      const show = toggle.checked;

      devTab.style.display = show ? '' : 'none';

      // 【iOS 12 修正】変更時の表示変更を強制リフレッシュ
      devTab.offsetWidth;

      localStorage.setItem('showDevTab', show);
      showNotification(show ? '開発タブを表示しました' : '開発タブを非表示にしました');
    }, 10); // 10msのわずかな遅延
  });
}

// === Theme system ===
const THEME_KEY = 'theme';

function applyTheme(theme) {
  const body = document.body;

  // IDを持つメタタグを取得 (HTML修正済みのため、これでOK)
  const themeColorMeta = document.getElementById('theme-color-meta');
  const statusBarStyleMeta = document.getElementById('status-bar-style-meta');

  // クラスの初期化
  body.classList.remove('dark-mode', 'light-mode', 'sepia-mode');

  if (theme === 'dark') {
    body.classList.add('dark-mode');

    // 【ダークモード時の PWA ステータスバー設定】
    if (themeColorMeta) themeColorMeta.content = '#121212'; // 背景色を黒に設定
    if (statusBarStyleMeta) statusBarStyleMeta.content = 'black'; // 文字色を黒にする

  } else if (theme === 'sepia') { // ★★★ このブロックを追加 ★★★
    body.classList.add('sepia-mode');

    // 【セピアモード時の PWA ステータスバー設定】
    // 背景色：sepia-theme.css のヘッダー色 (#ebe1ca) に近い明るい色
    if (themeColorMeta) themeColorMeta.content = '#ebe1ca';
    // 文字色：背景が明るいので黒にする (default)
    if (statusBarStyleMeta) statusBarStyleMeta.content = 'default';

  } else {
    // light モード (デフォルト)
    body.classList.add('light-mode');

    // 【ライトモード時の PWA ステータスバー設定】
    if (themeColorMeta) themeColorMeta.content = '#ffffff'; // 背景色を白に設定
    if (statusBarStyleMeta) statusBarStyleMeta.content = 'default'; // 文字色を黒にする
  }
}

// 起動時に強制的にテーマを適用し直すための関数呼び出し
document.addEventListener('DOMContentLoaded', () => {
  // initTheme() は setting.js にあるはずなので、それを利用
  if (typeof initTheme === 'function') {
    initTheme();
  }
});

function themeLabel(theme) {
  switch (theme) {
    case 'dark':
      return 'ダーク';
    case 'sepia':
      return 'セピア';
    case 'light':
    default:
      return 'ライト';
  }
}

// 修正
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';

  applyTheme(savedTheme);

  const select = document.getElementById('theme-select');
  if (select) {
    select.value = savedTheme;

    select.addEventListener('change', (e) => {
      const theme = e.target.value;
      applyTheme(theme);
      localStorage.setItem(THEME_KEY, theme);
      if (typeof showNotification === 'function') {
        showNotification(`${themeLabel(theme)} テーマを適用しました`);
      }
    });
  }
}
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
});

// --- Default Tab Preference -----------------------------

const TAB_KEYS = ["dashboard", "ranking", "balance", "history", "settings"];
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

  const saved = localStorage.getItem(DEFAULT_TAB_KEY) || "balance";
  if (TAB_KEYS.includes(saved)) select.value = saved;

  select.addEventListener("change", (e) => {
    // ベント処理の安定性を向上させるため setTimeout でラップ
    setTimeout(() => {
      const val = select.value; // e.target.value ではなく select.value
      if (TAB_KEYS.includes(val)) {
        localStorage.setItem(DEFAULT_TAB_KEY, val);
      }
    }, 10);
  });
}

/** 起動時にデフォルトタブを nav-item のクリックで開く */
function applyDefaultTabOnLoad() {
  let saved = localStorage.getItem(DEFAULT_TAB_KEY);
  if (!TAB_KEYS.includes(saved)) {
    saved = "balance";
    localStorage.setItem(DEFAULT_TAB_KEY, saved);
  }
  const navItem = findNavItem(saved);
  // 重要：switchTab は直接呼ばず、下メニューを「クリック」して切替

  // requestAnimationFrame や オプショナルチェイニングを排除し、
  // ゼロ遅延の setTimeout と if 文で最も安全な処理にする
  setTimeout(() => {
    if (navItem) {
      navItem.click();
    }
  }, 0);
}

// 修正
// <script>タグが</body>直前にあることを前提に、DOMContentLoadedを待たずに実行することで
// 競合を避け、古い環境での安定性を高める。

// 開発タブのトグルの初期化
initDevTabToggle();

// テーマの初期化
initTheme();

// デフォルトタブ設定UIの初期化
setupDefaultTabSelector();

// ページロード後のデフォルトタブへの移動処理を遅延させる
setTimeout(applyDefaultTabOnLoad, 50);

document.addEventListener('DOMContentLoaded', () => {
  // initTheme 関数がこのファイル内にあるため、そのまま呼び出します。
  // テーマ切り替えUIがないページでもテーマが適用されます。
  if (typeof initTheme === 'function') {
    initTheme();
  }
});