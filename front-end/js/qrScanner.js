// ===== 強化版 QR Scanner (jsQR, rAF, willReadFrequently, カメラ切替) =====
let qrStream = null;
let qrVideoTrackList = [];
let qrDeviceIds = [];
let qrCurrentIndex = 0;
let qrTicking = false;
let qrFrameCounter = 0;
const SCAN_INTERVAL = 5; // 5フレームに1回スキャン

// 既存DOM: モーダル/ビデオ/キャンバス/ステータス
const qrModal = document.getElementById('qr-scanner-modal');
const qrVideo = document.getElementById('qr-video');
const qrCanvas = document.getElementById('qr-canvas');
const qrStatus = document.getElementById('scanner-status');

//（任意）カメラ切替ボタンを使う場合は、HTMLに id="qrSwitchBtn" を置く
const qrSwitchBtn = document.getElementById('qr-switch-btn');

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

// モーダルを開いてスキャナ開始（= 旧 openQRScanner 相当）
function openQRScanner() {
  qrModal.classList.add('active');
  qrStatus.textContent = 'カメラの前にQRコードをかざしてください';
  qrStatus.className = 'scanner-status';

  return startQRScanning().catch(err => {
    qrStatus.textContent = 'カメラへのアクセスが拒否または失敗しました';
    qrStatus.className = 'scanner-status error';
    console.error('[QR] start failed:', err);
  });
}

// 実際の起動
function startQRScanning() {
  // 端末列挙（権限前はラベルが空のことがある）
  return enumerateCameras().then(() => {
    // 試行順：environment指定 → deviceId（列挙できた時のみ）
    const tryOrders = [
      { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      qrDeviceIds.length ? { audio: false, video: { deviceId: { exact: qrDeviceIds[qrCurrentIndex] } } } : null
    ].filter(Boolean);

    let lastErr = null;
    let i = 0;

    const tryNext = () => {
      if (i >= tryOrders.length) {
        return Promise.reject(lastErr || new Error('getUserMedia failed'));
      }

      const constraints = tryOrders[i++];
      return navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
          // いったん成功したらそれを使う
          qrStream = stream;
          qrVideoTrackList = qrStream.getVideoTracks();

          qrVideo.srcObject = qrStream;

          // メタデータ待ち
          return new Promise(resolve => {
            if (qrVideo.readyState >= 1 && qrVideo.videoWidth > 0) return resolve();
            qrVideo.onloadedmetadata = () => resolve();
          })
            .then(() => {
              let playPromise;
              try {
                playPromise = qrVideo.play();
              } catch (e) {
                playPromise = Promise.resolve();
              }
              return Promise.resolve(playPromise).catch(e => { });
            })
            .then(() => {
              // rAF でスキャン開始
              qrTicking = true;
              tickQr();

              // 切替ボタン（任意）
              if (qrSwitchBtn) {
                qrSwitchBtn.style.display = qrDeviceIds.length > 1 ? 'flex' : 'none';
                qrSwitchBtn.onclick = () => switchCamera().catch(() => { });
              }
            });
        })
        .catch(err => {
          lastErr = err;
          // 次の案へ
          return tryNext();
        });
    };

    return tryNext();
  });
}

function tickQr() {
  if (!qrTicking) return;
  qrFrameCounter++; // 毎フレーム、カウンターをインクリメント

  // 5フレームに1回だけ重い処理を実行
  if (qrFrameCounter % SCAN_INTERVAL === 0) {
    if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
      const vw = qrVideo.videoWidth;
      const vh = qrVideo.videoHeight;

      // 正方形にクロップするための計算
      const squareSize = Math.min(vw, vh);
      const cropX = (vw - squareSize) / 2;
      const cropY = (vh - squareSize) / 2;

      // パフォーマンス安定のため縮小して解析（正方形640x640目安）
      const targetSize = Math.min(640, squareSize);
      // const scale = targetSize / squareSize; // (未使用のため削除)

      // Canvas を正方形に設定
      if (qrCanvas.width !== targetSize || qrCanvas.height !== targetSize) {
        qrCanvas.width = targetSize;
        qrCanvas.height = targetSize;
      }

      const ctx = qrCanvas.getContext('2d', { willReadFrequently: true });
      // 正方形部分のみを描画
      ctx.drawImage(
        qrVideo,
        cropX, cropY, squareSize, squareSize,  // ソース（クロップ範囲）
        0, 0, targetSize, targetSize           // デスティネーション
      );

      // ピクセル取得 (ボトルネック1)
      const imageData = ctx.getImageData(0, 0, targetSize, targetSize);

      // デコード (ボトルネック2)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        // QRコード検出時の処理
        drawQrBox(ctx, code.location);
        qrStatus.textContent = 'QRコードを検出しました！';
        qrStatus.className = 'scanner-status success';

        const text = code.data;
        closeQRScanner();
        const userIdInput = document.querySelector('input[placeholder="ユーザーIDを入力"]');
        userIdInput.value = text;
        handleUserSearch();
        return; // 検出した場合はここでループを停止し終了
      }
    }
  }

  // 検出されなかった場合、またはスキャン間隔外のフレームの場合、次のフレームを要求
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

  try {
    await qrVideo.play();
  } catch (e) {
    console.warn("Video play() failed after switch, might be blocked:", e);
  }

  qrTicking = true;
  requestAnimationFrame(tickQr);
}