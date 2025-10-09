let currentUser = null;
let userData = { id: null, balance: 0 };
let updateInterval = null;
const API_BASE = '/api';

window.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
});

function checkLoginStatus() {
    const savedUserId = sessionStorage.getItem('userId');
    if (savedUserId) {
        currentUser = savedUserId;
        showMainApp();
    }
        }

async function login() {
    const id = document.getElementById('loginId').value.trim();
    const errorEl = document.getElementById('loginError');
    
    if (!id) {
        errorEl.textContent = 'IDを入力してください';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/balance/${id}`);
        
        if (response.ok) {
            const data = await response.json();
            currentUser = id;
            userData = data;
            sessionStorage.setItem('userId', id);
            showMainApp();
            errorEl.style.display = 'none';
        } else if (response.status === 404) {
            errorEl.textContent = 'ユーザーが見つかりません';
            errorEl.style.display = 'block';
        } else {
            errorEl.textContent = 'ログインに失敗しました';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        errorEl.textContent = 'サーバーに接続できません';
        errorEl.style.display = 'block';
    }
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    loadUserData();
    generateQRCode();
    startAutoUpdate();
    document.getElementById('home-tab-icon').classList.add('active');
}

function startAutoUpdate() {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(() => {
    const activeTab = document.querySelector('.tab-content.active').id;

    if (activeTab === 'homeTab') {
            loadUserData(true);
        } else if (activeTab === 'rankingTab') {
            loadRanking(true);
        } else if (activeTab === 'historyTab') {
            loadHistory(true);
        }
    }, 5000);
}

function showUpdateIndicator() {
            const indicator = document.getElementById('updateIndicator');
            indicator.classList.add('show');
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 1000);
        }

        async function loadUserData(silent = false) {
            try {
                if (!silent) showUpdateIndicator();
                const response = await fetch(`${API_BASE}/balance/${currentUser}`);
                if (response.ok) {
                    userData = await response.json();
                    updateBalanceDisplay();
                }
            } catch (error) {
                console.error('Failed to load user data:', error);
            }
        }

        function updateBalanceDisplay() {
            const balanceEl = document.getElementById('balanceAmount');
            const newBalance = `¥${userData.balance.toLocaleString()}`;
            
            if (balanceEl.textContent !== newBalance) {
                balanceEl.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    balanceEl.style.transform = 'scale(1)';
                }, 200);
            }
            
            balanceEl.textContent = newBalance;
            document.getElementById('displayUserId').textContent = `ID: ${userData.id}`;
            document.getElementById('settingsUserId').textContent = userData.id;
        }

        function generateQRCode() {
            const qrContainer = document.getElementById('qrcode');
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: currentUser,
                width: 220,
                height: 220,
                colorDark: "#2d3748",
                colorLight: "#ffffff",
            });
        }

        function switchTab(tab) {
            const tabs = document.querySelectorAll('.tab-content');
            tabs.forEach(t => t.classList.remove('active'));
            document.getElementById(`${tab}Tab`).classList.add('active');

            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => item.classList.remove('active'));
            event.currentTarget.classList.add('active');

            const titles = {
                home: 'ホーム',
                ranking: 'ランキング',
                history: '取引履歴',
                settings: '設定'
            };
            document.getElementById('appBarTitle').textContent = titles[tab];

            if (tab === 'ranking') {
                loadRanking();
            } else if (tab === 'history') {
                loadHistory();
            }
        }

        async function loadRanking(silent = false) {
            const listEl = document.getElementById('rankingList');
            if (!silent) {
                listEl.innerHTML = '<div class="loading">読み込み中</div>';
                showUpdateIndicator();
            }

            try {
                const response = await fetch(`${API_BASE}/ranking`);
                if (response.ok) {
                    const ranking = await response.json();
                    displayRanking(ranking);
                } else {
                    listEl.innerHTML = '<div class="error">ランキングの読み込みに失敗しました</div>';
                }
            } catch (error) {
                if (!silent) {
                    listEl.innerHTML = '<div class="error">サーバーに接続できません</div>';
                }
            }
        }

        function displayRanking(ranking) {
            const listEl = document.getElementById('rankingList');
            
            if (ranking.length === 0) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <span class="material-icons">leaderboard</span>
                        <div class="empty-state-text">ランキングデータがありません</div>
                    </div>
                `;
                return;
            }

            listEl.innerHTML = ranking.map((user, index) => {
                const rank = index + 1;
                let rankClass = '';
                if (rank === 1) rankClass = 'gold';
                else if (rank === 2) rankClass = 'silver';
                else if (rank === 3) rankClass = 'bronze';

                return `
                    <div class="ranking-item">
                        <div class="rank-number ${rankClass}">${rank}</div>
                        <div class="rank-info">
                            <div class="rank-id">${user.id}</div>
                            <div class="rank-balance">¥${user.balance.toLocaleString()}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        async function loadHistory() {
            const listEl = document.getElementById('historyList');
            listEl.innerHTML = '<div class="loading">読み込み中</div>';
            showUpdateIndicator();

            try {
                const response = await fetch(`${API_BASE}/history`);
                if (response.ok) {
                    const history = await response.json();
                    const userHistory = history.filter(item => item.id === currentUser);
                    displayHistory(userHistory);
                } else {
                    listEl.innerHTML = '<div class="error">履歴の読み込みに失敗しました</div>';
                }
            } catch (error) {
                listEl.innerHTML = '<div class="error">サーバーに接続できません</div>';
            }
        }

        function displayHistory(history) {
            const listEl = document.getElementById('historyList');
            
            if (history.length === 0) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <span class="material-icons">history</span>
                        <div class="empty-state-text">取引履歴がありません</div>
                    </div>
                `;
                return;
            }

            listEl.innerHTML = history.map(item => {
                const date = new Date(item.timestamp);
                const dateStr = date.toLocaleString('ja-JP');
                
                let typeLabel = '';
                let amountClass = '';
                let amountPrefix = '';
                
                if (item.type === 'add') {
                    typeLabel = '入金';
                    amountClass = 'positive';
                    amountPrefix = '+';
                } else if (item.type === 'subtract') {
                    typeLabel = '出金';
                    amountClass = 'negative';
                    amountPrefix = '';
                } else if (item.type === 'generate') {
                    typeLabel = 'アカウント作成';
                    amountClass = 'positive';
                    amountPrefix = '+';
                }

                return `
                    <div class="history-item">
                        <div class="history-header">
                            <div class="history-type">${typeLabel}</div>
                            <div class="history-amount ${amountClass}">
                                ${amountPrefix}¥${Math.abs(item.amount).toLocaleString()}
                            </div>
                        </div>
                        <div class="history-details">
                            ${item.games ? `ゲーム: ${item.games}` : ''}
                            ${item.dealer ? ` | ディーラー: ${item.dealer}` : ''}
                        </div>
                        <div class="history-details">${dateStr}</div>
                        <div class="history-details">残高: ¥${item.balance.toLocaleString()}</div>
                    </div>
                `;
            }).join('');
        }

        function logout() {
            if (confirm('ログアウトしますか?')) {
                switchTab('home');
                if (updateInterval) clearInterval(updateInterval);
                sessionStorage.removeItem('userId');
                currentUser = null;
                userData = { id: null, balance: 0 };
                document.getElementById('mainApp').style.display = 'none';
                document.getElementById('loginScreen').style.display = 'block';
                document.getElementById('loginId').value = '';
            }
        }
        
// ===== 強化版 QR Scanner (jsQR, rAF, willReadFrequently, カメラ切替) =====
let qrStream = null;
let qrVideoTrackList = [];
let qrDeviceIds = [];
let qrCurrentIndex = 0;
let qrTicking = false;

// 既存DOM: モーダル/ビデオ/キャンバス/ステータス
const qrModal = document.getElementById('qrScannerModal');
const qrVideo = document.getElementById('qrVideo');
const qrCanvas = document.getElementById('qrCanvas');
const qrStatus = document.getElementById('scannerStatus');

//（任意）カメラ切替ボタンを使う場合は、HTMLに id="qrSwitchBtn" を置く
const qrSwitchBtn = document.getElementById('qrSwitchBtn');

async function enumerateCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(d => d.kind === 'videoinput');
    qrDeviceIds = videos.map(v => v.deviceId);
    // 背面(environment/back) っぽいデバイスを優先
    const envIdx = videos.findIndex(v => /back|environment/i.test(v.label));
    if (envIdx >= 0) qrCurrentIndex = envIdx;
  } catch (e) {
    // 取得できない環境(iOSの初回など)は後続の getUserMedia で権限付与後に再取得
    qrDeviceIds = [];
  }
}

// モーダルを開いてスキャナ開始（= 旧 openQRScanner 相当）
async function openQRScanner() {
  qrModal.classList.add('active');
  qrStatus.textContent = 'カメラの前にQRコードをかざしてください';
  qrStatus.className = 'scanner-status';

  try {
    await startQRScanning();
  } catch (err) {
    qrStatus.textContent = 'カメラへのアクセスが拒否または失敗しました';
    qrStatus.className = 'scanner-status error';
    console.error('[QR] start failed:', err);
  }
}

// 実際の起動
async function startQRScanning() {
  // 端末列挙（権限前はラベルが空のことがある）
  await enumerateCameras();

  // 試行順：environment指定 → deviceId（列挙できた時のみ）
  const tryOrders = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    qrDeviceIds.length ? { audio: false, video: { deviceId: { exact: qrDeviceIds[qrCurrentIndex] } } } : null
  ].filter(Boolean);

  let lastErr = null;

  for (let i = 0; i < tryOrders.length; i++) {
    try {
      const constraints = tryOrders[i];
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // いったん成功したらそれを使う
      qrStream = stream;
      qrVideoTrackList = qrStream.getVideoTracks();

      qrVideo.srcObject = qrStream;

      // メタデータ待ち
      await new Promise(resolve => {
        if (qrVideo.readyState >= 1 && qrVideo.videoWidth > 0) return resolve();
        qrVideo.onloadedmetadata = () => resolve();
      });

      try { await qrVideo.play(); } catch {}

      // rAF でスキャン開始
      qrTicking = true;
      tickQr();

      // 切替ボタン（任意）
      if (qrSwitchBtn) {
        qrSwitchBtn.style.display = qrDeviceIds.length > 1 ? 'inline-flex' : 'none';
        qrSwitchBtn.onclick = () => switchCamera().catch(()=>{});
      }

      return; // 成功
    } catch (err) {
      lastErr = err;
      // 次の案へ
    }
  }
  throw lastErr || new Error('getUserMedia failed');
}

function tickQr() {
  if (!qrTicking) return;

  if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
    const vw = qrVideo.videoWidth;
    const vh = qrVideo.videoHeight;

    // パフォーマンス安定のため縮小して解析（幅 640 目安）
    const targetW = Math.min(640, vw);
    const scale = targetW / vw;
    const targetH = Math.round(vh * scale);

    // Canvas を毎回作り直さず固定サイズで再利用
    if (qrCanvas.width !== targetW || qrCanvas.height !== targetH) {
      qrCanvas.width = targetW;
      qrCanvas.height = targetH;
    }

    const ctx = qrCanvas.getContext('2d', { willReadFrequently: true });
    // 現フレーム描画
    ctx.drawImage(qrVideo, 0, 0, targetW, targetH);

    // ピクセル取得
    const imageData = ctx.getImageData(0, 0, targetW, targetH);

    // デコード（まずは dontInvert、必要に応じ attemptBoth）
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (code && code.data) {
      // 四隅ガイド（任意）
      drawQrBox(ctx, code.location);
      qrStatus.textContent = 'QRコードを検出しました！';
      qrStatus.className = 'scanner-status success';

      // ストップして結果処理
      const text = code.data;
      closeQRScanner();
      // あなたのアプリのログイン共通関数へ
      // 例) performLogin(text);
      document.getElementById('loginId').value = text;
      login();
      return;
    }
  }

  requestAnimationFrame(tickQr);
}

function drawQrBox(ctx, loc) {
  const draw = (a, b) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#00e676';
    ctx.stroke();
  };
  draw(loc.topLeftCorner, loc.topRightCorner);
  draw(loc.topRightCorner, loc.bottomRightCorner);
  draw(loc.bottomRightCorner, loc.bottomLeftCorner);
  draw(loc.bottomLeftCorner, loc.topLeftCorner);
}

// モーダル閉じて停止（= 旧 closeQRScanner 相当）
function closeQRScanner() {
  qrTicking = false;

  if (qrVideoTrackList && qrVideoTrackList.length) {
    qrVideoTrackList.forEach(t => t.stop());
  }
  qrVideoTrackList = [];
  qrStream = null;
  qrVideo.srcObject = null;

  qrModal.classList.remove('active');
}

// カメラ切替（任意で使う）
async function switchCamera() {
  if (!qrDeviceIds.length) return;
  qrCurrentIndex = (qrCurrentIndex + 1) % qrDeviceIds.length;

  // いったん停止して再起動
  if (qrVideoTrackList && qrVideoTrackList.length) {
    qrVideoTrackList.forEach(t => t.stop());
  }
  qrVideoTrackList = [];
  qrStream = null;
  qrVideo.srcObject = null;

  // deviceId 指定で再起動
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { deviceId: { exact: qrDeviceIds[qrCurrentIndex] } }
  });

  qrStream = stream;
  qrVideoTrackList = qrStream.getVideoTracks();
  qrVideo.srcObject = qrStream;

  await new Promise(resolve => {
    if (qrVideo.readyState >= 1 && qrVideo.videoWidth > 0) return resolve();
    qrVideo.onloadedmetadata = () => resolve();
  });
  try { await qrVideo.play(); } catch {}

  qrTicking = true;
  requestAnimationFrame(tickQr);
}