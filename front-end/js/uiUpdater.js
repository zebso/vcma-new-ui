// UI Update functions
function updateBalanceDisplay(balance, exchangeableBalance) {
  const balanceElement = document.querySelector('.balance-amount');
  balanceElement.innerHTML = `${formatCurrency(balance)} <br><span>(商品交換可能：${formatCurrency(exchangeableBalance)})</span>`;
  currentBalance = balance;
  currentExchangeableBalance = exchangeableBalance;
}

function handleCreateUser() {
  const idInput = document.getElementById('new-user-id');
  const balInput = document.getElementById('initial-balance');

  let id = (idInput.value || '').trim();
  if (!id) {
    id = generateUserId();
    idInput.value = id; // 画面にも反映
  }

  const balance = Math.max(0, parseInt(balInput.value || '0', 10) || 0);

  createUser(id, balance)
    .then((res) => {
      const created = res.user; // { id, balance }
      showNotification(`ユーザー ${created.id} を作成しました`);
      balInput.value = '';
    })
    .catch((e) => {
      // apiCall 側で通知済み
    })
    .then(
      () => {
        // ダッシュボード数値も更新
        loadDashboard();
      },
      () => {
        // 成功・失敗に関わらず実行（Promise.finallyの代替）
        loadDashboard();
      }
    );
}

function generateUserId() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `CC-2025-${suffix}`;
}

function updateRankingDisplay(ranking) {
  const container = document.getElementById('ranking-box');

  container.innerHTML = '<div class="ranking-top"></div><div class="ranking-bottom"></div>';
  const rankingTop = container.querySelector('.ranking-top');
  const rankingBottom = container.querySelector('.ranking-bottom');

  ranking.forEach((user, index) => {
    const item = document.createElement('div');
    item.className = `ranking-item content-box rank-${index + 1}`;
    item.innerHTML = `
      <div class="ranking-number">${index + 1}</div>
      <div class="ranking-info">
        <div class="ranking-name">${user.id}</div>
        <div class="ranking-amount">${formatCurrency(user.balance)}</div>
      </div>
    `;
    
    if (index <= 2) {
      // 1~3位は特別デザイン
      rankingTop.appendChild(item);
    } else {
      rankingBottom.appendChild(item);
    }
  });
  // 作成ボタン
  document.getElementById('create-user-btn').addEventListener('click', handleCreateUser);
}

// 追加: 履歴のページング/無限スクロール実装
const HISTORY_PAGE_SIZE = 20;
let _histAll = [];
let _histIndex = 0;
let _histObserver = null;
let _histSentinel = null;

function resetHistoryPagination() {
  _histAll = [];
  _histIndex = 0;

  if (_histObserver) {
    _histObserver.disconnect();
    _histObserver = null;
  }
  if (_histSentinel && _histSentinel.parentNode) {
    _histSentinel.parentNode.removeChild(_histSentinel);
  }
  _histSentinel = null;
}

function createHistoryItemNode(item) {
  const historyItem = document.createElement('div');
  historyItem.className = 'history-item content-box';

  const typeText = {
    'add': '入金',
    'subtract': '出金',
    'generate': 'アカウント作成'
  }[item.type] || item.type;

  const isPositive = (item.type === 'add' || item.type === 'generate');
  const amountClass = isPositive ? 'positive' : 'negative';
  const amountText = isPositive
    ? `+${formatCurrency(Math.abs(item.amount))}`
    : `-${formatCurrency(Math.abs(item.amount))}`;

  historyItem.innerHTML = `
    <div class="history-user">ユーザーID: ${item.id}</div>
    <div class="history-date">${formatDate(item.timestamp)}</div>
    <div class="history-description">${typeText}${item.games ? ` (${item.games})` : ''}</div>
    <div class="history-amount ${amountClass}">${amountText}</div>
  `;
  return historyItem;
}

function renderNextHistoryBatch(container) {
  const slice = _histAll.slice(_histIndex, _histIndex + HISTORY_PAGE_SIZE);
  slice.forEach(item => container.appendChild(createHistoryItemNode(item)));
  _histIndex += slice.length;
}

function ensureHistoryObserver(container) {
  if (_histObserver) return;

  // 末尾監視用のsentinelを設置
  _histSentinel = document.createElement('div');
  _histSentinel.id = 'history-sentinel';
  _histSentinel.style.cssText = 'height: 1px;';
  container.appendChild(_histSentinel);

  // コンテナ自身がスクロール領域ならrootに設定（overflowがvisible以外）
  const isScrollableContainer = getComputedStyle(container).overflowY !== 'visible';
  const observerOptions = isScrollableContainer
    ? { root: container, rootMargin: '0px 0px 200px 0px' }
    : { rootMargin: '0px 0px 200px 0px' };

  _histObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry || !entry.isIntersecting) return;

    if (_histIndex < _histAll.length) {
      renderNextHistoryBatch(container);

      // 2度目以降はスクロール位置がずれるのでsentinelを再配置
      if (_histSentinel && _histSentinel.parentNode) {
        // sentinelを末尾に移動
        _histSentinel.parentNode.removeChild(_histSentinel);
        container.appendChild(_histSentinel);
      }
    }

    // 出し切ったら後片付け
    if (_histIndex >= _histAll.length) {
      _histObserver.disconnect();
      _histObserver = null;
      if (_histSentinel && _histSentinel.parentNode) {
        _histSentinel.parentNode.removeChild(_histSentinel);
      }
      _histSentinel = null;
    }
  }, observerOptions);

  _histObserver.observe(_histSentinel);
}

function updateHistoryDisplay(history) {
  const container = document.getElementById('history');
  const title = container.querySelector('h3');

  // 初期化
  container.innerHTML = '';
  if (title) container.appendChild(title);

  resetHistoryPagination();

  // 空配列ハンドリング
  if (!history || history.length === 0) {
    const noData = document.createElement('div');
    noData.style.cssText = 'text-align: center; padding: 40px 20px; color: #666;';
    noData.innerHTML = '<i class="material-icons" style="font-size: 48px; margin-bottom: 16px;">history</i><div>取引履歴がありません</div>';
    container.appendChild(noData);
    return;
  }

  // 配列を保持し、最初の20件を描画
  _histAll = history;
  renderNextHistoryBatch(container);

  // まだ残っているなら無限スクロールを有効化
  if (_histIndex < _histAll.length) {
    ensureHistoryObserver(container);
  }
}

function updateDashboardDisplay(stats) {
  document.getElementById('active-ids').textContent = stats.activeIds.toLocaleString();
  document.getElementById('total-balance').textContent = formatCurrency(stats.totalBalance);
  document.getElementById('total-transactions').textContent = stats.totalTransactions.toLocaleString();
}