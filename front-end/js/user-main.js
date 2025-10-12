const API_BASE = '/api'; // APIのベースURLに変更してください

let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let stream = null;
let scanInterval = null;
let autoCloseTimer = null;

// カメラ管理
let qrDeviceIds = [];
let qrCurrentIndex = 0;

// カメラ列挙
function enumerateCameras() {
  return navigator.mediaDevices.enumerateDevices()
    .then(devices => {
      const videos = devices.filter(d => d.kind === 'videoinput');
      qrDeviceIds = videos.map(v => v.deviceId);
      // 背面(environment/back) っぽいデバイスを優先
      const envIdx = videos.findIndex(v => /back|environment/i.test(v.label));
      if (envIdx >= 0) qrCurrentIndex = envIdx;
    })
    .catch(e => {
      // 取得できない環境(iOSの初回など)は後続の getUserMedia で権限付与後に再取得
      qrDeviceIds = [];
    });
}

// カメラ起動
async function startCamera() {
  try {
    // 既存のストリームを停止
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // カメラデバイスがない場合は列挙
    if (qrDeviceIds.length === 0) {
      await enumerateCameras();
    }

    let constraints;
    if (qrDeviceIds.length > 0 && qrDeviceIds[qrCurrentIndex]) {
      constraints = {
        video: {
          deviceId: {
            exact: qrDeviceIds[qrCurrentIndex]
          }
        }
      };
    } else {
      constraints = {
        video: {
          facingMode: 'environment'
        }
      };
    }

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    // 初回の場合、権限取得後に再列挙
    if (qrDeviceIds.length === 0) {
      await enumerateCameras();
    }

    startScanning();
  } catch (err) {
    showError('カメラにアクセスできませんでした');
    console.error(err);
  }
}

// カメラ切り替え
document.getElementById('switchCameraBtn').addEventListener('click', async () => {
  if (qrDeviceIds.length <= 1) return;

  qrCurrentIndex = (qrCurrentIndex + 1) % qrDeviceIds.length;
  await startCamera();
});

// QRコードスキャン開始
function startScanning() {
  scanInterval = setInterval(() => {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        handleQRDetected(code.data);
      }
    }
  }, 300);
}

// QRコード検出処理
async function handleQRDetected(qrData) {
  stopScanning();

  try {
    // 残高取得
    const balanceRes = await fetch(`${API_BASE}/balance/${qrData}`);
    if (!balanceRes.ok) {
      throw new Error('IDが見つかりませんでした');
    }
    const balance = await balanceRes.json();

    // ランキング取得
    const rankingRes = await fetch(`${API_BASE}/ranking`);
    const ranking = await rankingRes.json();

    const rank = ranking.findIndex(r => r.id === qrData) + 1;

    showBalance(balance.id, balance.balance, rank || '-');
  } catch (err) {
    showError(err.message || 'データの取得に失敗しました');
  }
}

// 残高表示
function showBalance(id, balance, rank) {
  document.getElementById('userIdChip').textContent = id;
  document.getElementById('balanceAmount').textContent = `¥${balance.toLocaleString()}`;
  document.getElementById('rankNumber').textContent = rank === '-' ? '-' : rank;

  const card = document.getElementById('balanceCard');
  card.classList.add('show');

  // プログレスバーリセット
  const progressFill = document.getElementById('progressFill');
  progressFill.style.animation = 'none';
  setTimeout(() => {
    progressFill.style.animation = 'shrink 10s linear';
  }, 10);

  // 10秒後に自動クローズ
  autoCloseTimer = setTimeout(() => {
    closeBalance();
  }, 10000);
}

// 残高カードを閉じる
function closeBalance() {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  document.getElementById('balanceCard').classList.remove('show');
  startCamera();
}

document.getElementById('closeBtn').addEventListener('click', closeBalance);

// エラー表示
function showError(message) {
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorCard').classList.add('show');

  setTimeout(() => {
    closeError();
  }, 3000);
}

function closeError() {
  document.getElementById('errorCard').classList.remove('show');
  startCamera();
}

// スキャン停止
function stopScanning() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

// 初期化
startCamera();