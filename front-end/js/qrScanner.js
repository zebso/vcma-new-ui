// ===== QR Scanner (jsQR) =====
let qrStream = null;
let qrTrackList = [];
let qrDeviceIds = [];
let qrCurrentIndex = 0;
let qrTicking = false;

const qrScanner = document.getElementById('qr-scanner');
const qrVideo = document.getElementById('qr-video');
const qrCanvas = document.getElementById('qr-canvas');
const qrOverlay = document.getElementById('qr-overlay');
const qrStopBtn = document.getElementById('qr-stop-btn');
const qrSwitchBtn = document.getElementById('qr-switch-btn');

const qrIdle = document.getElementById('qr-idle');

async function enumerateCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videos = devices.filter(d => d.kind === 'videoinput');
  qrDeviceIds = videos.map(v => v.deviceId);
  // 背面カメラらしきデバイスを優先（environment）
  if (qrDeviceIds.length > 1) {
    const envIdx = videos.findIndex(v => /back|environment/i.test(v.label));
    if (envIdx >= 0) qrCurrentIndex = envIdx;
  }
}

async function startQrScanner() {
  // 1. まず簡易許可プリフライト（iOS対策&ユーザーに権限ダイアログを出す）
  async function warmup(constraints) {
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      s.getTracks().forEach(t => t.stop()); // すぐ止める
      return true;
    } catch (e) {
      throw e;
    }
  }

  // 2. 使いやすいメッセージに変換
  function humanizeError(err) {
    const name = err && (err.name || err.code) || '';
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'カメラの使用がブロックされています。サイトの権限から「カメラを許可」に変更してください。';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'カメラデバイスが見つかりません。実機で、または外付けカメラ接続後に再試行してください。';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'カメラを占有している別アプリがある可能性があります。ほかのアプリ/タブを閉じてください。';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return '指定したカメラ制約に合致するデバイスがありません。カメラ切替でお試しください。';
      case 'SecurityError':
        return '安全なコンテキストが必要です。HTTPSでアクセスするか、ローカルは http://localhost を使用してください。';
      default:
        return `不明なエラーです（${name || 'no-name'}）。ページを再読込して再試行してください。`;
    }
  }

  // 3. 実処理
  try {
    await enumerateCameras();

    // A. まず facingMode で起動→失敗したら deviceId 指定で再試行
    const tryOrders = [
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
      qrDeviceIds.length ? { audio: false, video: { deviceId: { exact: qrDeviceIds[qrCurrentIndex] } } } : null
    ].filter(Boolean);

    let lastErr = null;
    for (const constraints of tryOrders) {
      try {
        // 許可ダイアログをここで出しつつ検証
        await warmup(constraints);

        // 本番ストリーム取得
        qrStream = await navigator.mediaDevices.getUserMedia(constraints);
        qrTrackList = qrStream.getVideoTracks();

        qrVideo.srcObject = qrStream;
        await qrVideo.play();

        qrVideo.style.display = 'block';
        qrOverlay.style.display = 'block';
        qrIdle.style.display = 'none';

        qrTicking = true;
        tickQr();
        showNotification('スキャンを開始しました');
        return; // 成功
      } catch (err) {
        lastErr = err;
        continue; // 次の方法で再試行
      }
    }

    // どれも失敗
    throw lastErr || new Error('Unknown getUserMedia error');

  } catch (err) {
    // 具体的な説明を出す
    const msg = humanizeError(err);
    showNotification(`カメラを起動できません: ${msg}`, 'error');

    // 典型的なブロック時のヒントをUIにも残す（任意）
    console.error('[QR] getUserMedia failed:', err);
  }
}

function stopQrScanner() {
  qrTicking = false;
  if (qrTrackList) {
    qrTrackList.forEach(t => t.stop());
  }
  qrStream = null;
  qrVideo.srcObject = null;

  qrVideo.style.display = 'none';
  qrOverlay.style.display = 'none';
  qrIdle.style.display = 'block';
}

async function switchCamera() {
  if (!qrDeviceIds.length) return;
  stopQrScanner();
  qrCurrentIndex = (qrCurrentIndex + 1) % qrDeviceIds.length;
  await startQrScanner();
}

function drawLine(ctx, begin, end) {
  ctx.beginPath();
  ctx.moveTo(begin.x, begin.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineWidth = 4;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--qr-line') || '#00e676';
  ctx.stroke();
}

function tickQr() {
  if (!qrTicking) return;

  if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
    const width = qrVideo.videoWidth;
    const height = qrVideo.videoHeight;

    // Canvasサイズを動画に合わせる
    qrCanvas.width = width;
    qrCanvas.height = height;

    const ctx = qrCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(qrVideo, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    // デコード
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

    // 前の枠を消す
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(qrVideo, 0, 0, width, height);

    if (code) {
      // 見つかった四隅を描画（オーバーレイ用途にcanvasを一時表示）
      // ※ 見た目重視なら別Canvasを重ねる構成もOK
      drawLine(ctx, code.location.topLeftCorner, code.location.topRightCorner);
      drawLine(ctx, code.location.topRightCorner, code.location.bottomRightCorner);
      drawLine(ctx, code.location.bottomRightCorner, code.location.bottomLeftCorner);
      drawLine(ctx, code.location.bottomLeftCorner, code.location.topLeftCorner);

      handleQrResult(code.data);
      return; // 見つかったら停止（複数回発火防止）
    }
  }
  // 次フレームへ
  requestAnimationFrame(tickQr);
}

function handleQrResult(text) {
  stopQrScanner();

  // ここでアプリの入力欄へ反映
  const userIdInput = document.querySelector('input[placeholder="ユーザーIDを入力"]');
  userIdInput.value = text;

  showNotification('QRコードを読み取りました');

  // 自動で検索実行（任意）
  handleUserSearch();
}

// クリックで開始/停止
qrScanner.addEventListener('click', (e) => {
  // ボタン領域のクリックはここでは処理しない
  if (e.target === qrStopBtn || e.target === qrSwitchBtn) return;

  if (!qrStream) startQrScanner();
});

// 明示ボタン
qrStopBtn.addEventListener('click', stopQrScanner);
qrSwitchBtn.addEventListener('click', switchCamera);

// iOSの権限プリフライト（必須ではない）
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  // 何もしない（必要時に起動）
} else {
  // フォールバック: ファイルから読み取り
  const fallback = document.createElement('input');
  fallback.type = 'file';
  fallback.accept = 'image/*';
  fallback.capture = 'environment';
  fallback.style.marginTop = '8px';
  fallback.addEventListener('change', async (evt) => {
    const file = evt.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      qrCanvas.width = img.width;
      qrCanvas.height = img.height;
      const ctx = qrCanvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        handleQrResult(code.data);
      } else {
        showNotification('QRを認識できませんでした', 'error');
      }
    };
    img.src = URL.createObjectURL(file);
  });
  qrScanner.appendChild(fallback);
}