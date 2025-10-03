// Global state
let currentUserId = null;
let currentBalance = 0;
let isLoading = false;

// API Base URL (プロダクションでは実際のサーバーのURLに変更)
const API_BASE = '/api';

// Dark mode functions
function initDarkMode() {
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    document.getElementById('dark-mode-toggle').checked = true;
  }
}

function toggleDarkMode() {
  const isDarkMode = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDarkMode);

  // 通知表示
  showNotification(isDarkMode ? 'ダークモードをオンにしました' : 'ライトモードをオンにしました');
}

// Utility functions
function showLoading(show) {
  isLoading = show;
  // ローディング状態の表示/非表示
  document.querySelectorAll('.btn').forEach(btn => {
    btn.disabled = show;
    if (show) {
      btn.style.opacity = '0.6';
    } else {
      btn.style.opacity = '1';
    }
  });
}

function showNotification(message, type = 'info') {
  // 簡単な通知表示
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    word-break: keep-all;
    background: ${type === 'error' ? '#f44336' : '#4caf50'};
    color: #fff;
    padding: 12px 24px;
    border-radius: 4px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0
  }).format(amount);
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('ja-JP');
}

// Event handlers
function handleUserSearch() {
  const userIdInput = document.querySelector('input[placeholder="ユーザーIDを入力"]');
  const userId = userIdInput.value.trim();

  if (!userId) {
    showNotification('ユーザーIDを入力してください', 'error');
    return;
  }

  getBalance(userId)
    .then((userData) => {
      currentUserId = userData.id;
      updateBalanceDisplay(userData.balance);
      showNotification(`ユーザー ${userId} を読み込みました`);
    })
    .catch((error) => {
      if (error && error.message && error.message.includes('not found')) {
        const createNew = confirm(`ユーザー ${userId} が見つかりません。新規作成しますか？`);
        if (createNew) {
          createUser(userId, 0)
            .then((newUser) => {
              currentUserId = newUser.user.id;
              updateBalanceDisplay(newUser.user.balance);
              showNotification(`新規ユーザー ${userId} を作成しました`);
            })
            .catch((createError) => {
              // エラーは既にshowNotificationで表示される
            });
        }
      }
    });
}

function handleMoneyChange(isAdd) {
  if (!currentUserId) {
    showNotification('先にユーザーを選択してください', 'error');
    return;
  }

  const amountInput = document.querySelector('input[placeholder="金額を入力"]');
  const gameInput = document.getElementById('game-type');
  const amount = parseInt(amountInput.value);
  const games = (gameInput?.value || '').trim();

  if (!amount || amount <= 0) {
    showNotification('正しい金額を入力してください', 'error');
    return;
  }

  const request = isAdd
    ? addMoney(currentUserId, amount, games)
    : subtractMoney(currentUserId, amount, games);

  request
    .then((result) => {
      updateBalanceDisplay(result.balance);
      amountInput.value = '';
      if (gameInput) gameInput.value = '';
      showNotification(`${isAdd ? '追加' : '減算'}が完了しました`);
    })
    .catch((error) => {
      // エラーは既にshowNotificationで表示される
    });
}

function loadRanking() {
  getRanking()
    .then((ranking) => {
      updateRankingDisplay(ranking);
    })
    .catch((error) => {
      // エラーは既にshowNotificationで表示される
    });
}

function loadHistory() {
  getHistory()
    .then((history) => {
      updateHistoryDisplay(history);
    })
    .catch((error) => {
      // エラーは既にshowNotificationで表示される
    });
}

function loadDashboard() {
  getDashboardStats()
    .then((stats) => {
      updateDashboardDisplay(stats);
    })
    .catch((error) => {
      // エラーは既にshowNotificationで表示される
    });
}

function switchTab(tabName, navItem) {
  // Hide all tab contents
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => content.classList.remove('active'));

  // Show selected tab
  document.getElementById(tabName).classList.add('active');

  // Update navigation active state
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  navItem.classList.add('active');

  // Update header title
  const titles = {
    'balance': '所持金管理',
    'dashboard': 'ダッシュボード',
    'ranking': 'ユーザー',
    'history': '取引履歴',
    'settings': '設定'
  };
  document.getElementById('header-title').textContent = titles[tabName];

  // Load data when switching to certain tabs
  if (tabName === 'dashboard') {
    loadDashboard();
  } else if (tabName === 'ranking') {
    loadRanking();
  } else if (tabName === 'history') {
    loadHistory();
  }

  window.scroll({
    top: 0,
    behavior: "smooth",
  });
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function () {
  // ダークモードの初期化
  initDarkMode();

  // 初期表示時にダッシュボードを読み込み
  loadDashboard();
  // Search button
  const searchBtn = document.querySelector(
    '.input-section button.btn:not(#qr-stop-btn):not(#qr-switch-btn)'
  );
  searchBtn.addEventListener('click', handleUserSearch);

  // Add/Subtract buttons
  const addBtn = document.querySelectorAll('.input-section')[1].querySelector('.btn');
  const subtractBtn = document.querySelectorAll('.input-section')[1].querySelector('.btn-outline');

  addBtn.addEventListener('click', () => handleMoneyChange(true));
  subtractBtn.addEventListener('click', () => handleMoneyChange(false));

  // ダークモードトグル
  document.getElementById('dark-mode-toggle').addEventListener('change', toggleDarkMode);
  // Button interactions
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function () {
      if (!this.disabled) {
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
          this.style.transform = 'scale(1)';
        }, 100);
      }
    });
  });
});