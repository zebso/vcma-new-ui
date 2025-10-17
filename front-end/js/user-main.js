//カメラ部分の動作deviceIdからfacingmode中心の処理にAIが変更

var API_BASE = '/api'; // APIのベースURLに変更してください

var video = document.getElementById('video');
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var stream = null;
var scanInterval = null;
var autoCloseTimer = null;

// カメラ管理
var qrDeviceIds = [];
var qrCurrentIndex = 0;
var qrCurrentFacingMode = 'user';

// カメラ列挙
function enumerateCameras() {
  return navigator.mediaDevices.enumerateDevices()
    .then(function(devices) {
      var videos = devices.filter(function(d) { return d.kind === 'videoinput'; });
      qrDeviceIds = videos.map(function(v) { return v.deviceId; });
      // 背面(environment/back) っぽいデバイスを優先
      var envIdx = videos.findIndex(function(v) { return /back|environment/i.test(v.label); });
      if (envIdx >= 0) qrCurrentIndex = envIdx;
    })
    .catch(function(e) {
      // 取得できない環境(iOSの初回など)は後続の getUserMedia で権限付与後に再取得
      qrDeviceIds = [];
    });
}

// カメラ起動
function startCamera() {
  // 既存のストリームを停止
  if (stream) {
    stream.getTracks().forEach(function(track) { track.stop(); });
    stream = null;
    video.srcObject = null;
  }

  // 端末列挙
  return enumerateCameras().then(function() {
    var tryOrders = [
      // 1. qrCurrentFacingModeでの起動を最優先（切り替え時）
      { video: { facingMode: qrCurrentFacingMode } },
      // 2. 最後の手段：何でもいいからカメラを試す
      { video: true } 
    ].filter(Boolean);

    var lastErr = null;
    var i = 0;

    var tryNext = function() {
      if (i >= tryOrders.length) {
        return Promise.reject(lastErr || new Error('カメラにアクセスできませんでした'));
      }

      var constraints = tryOrders[i++];
      return navigator.mediaDevices.getUserMedia(constraints)
        .then(function(newStream) {
          stream = newStream;
          video.srcObject = stream;

          // 初回の場合、権限取得後に再列挙
          if (qrDeviceIds.length === 0) {
            return enumerateCameras();
          }
          return Promise.resolve();
        })
        .then(function() {
          startScanning();
          // 成功したらresolve
          return Promise.resolve();
        })
        .catch(function(err) {
          lastErr = err;
          // 次の案へ
          return tryNext();
        });
    };
    
    return tryNext();

  }).catch(function(err) {
    showError('カメラにアクセスできませんでした');
    console.error(err);
    throw err; // エラーを上位へ伝播
  });
}

// カメラ切り替え
document.getElementById('switchCameraBtn').addEventListener('click', function() {

  // facingMode を反転させる (user <-> environment)
  qrCurrentFacingMode = (qrCurrentFacingMode === 'user') ? 'environment' : 'user';

  // 1. ストリーム停止
  if (stream) {
    stream.getTracks().forEach(function(track) { track.stop(); });
    stream = null;
    video.srcObject = null;
  }
  
  // 2. 新しい facingMode で再起動 (startCamera 関数が再利用できる)
  startCamera();
});

// QRコードスキャン開始
function startScanning() {
  scanInterval = setInterval(function() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        handleQRDetected(code.data);
      }
    }
  }, 300);
}

// QRコード検出処理
function handleQRDetected(qrData) {
  stopScanning();

  // 残高取得
  fetch(API_BASE + '/balance/' + qrData)
    .then(function(balanceRes) {
      if (!balanceRes.ok) {
        throw new Error('IDが見つかりませんでした');
      }
      return balanceRes.json();
    })
    .then(function(balance) {
      // ランキング取得
      return fetch(API_BASE + '/ranking')
        .then(function(rankingRes) {
          return rankingRes.json();
        })
        .then(function(ranking) {
          var rank = ranking.findIndex(function(r) { return r.id === qrData; }) + 1;
          showBalance(balance.id, balance.balance, rank || '-');
        });
    })
    .catch(function(err) {
      showError(err.message || 'データの取得に失敗しました');
    });
}

// 残高表示
function showBalance(id, balance, rank) {
  document.getElementById('userIdChip').textContent = id;
  document.getElementById('balanceAmount').textContent = '¥' + balance.toLocaleString();
  document.getElementById('rankNumber').textContent = rank === '-' ? '-' : rank;

  var card = document.getElementById('balanceCard');
  card.classList.add('show');

  // プログレスバーリセット
  var progressFill = document.getElementById('progressFill');
  progressFill.style.animation = 'none';
  setTimeout(function() {
    progressFill.style.animation = 'shrink 10s linear';
  }, 10);

  // 10秒後に自動クローズ
  autoCloseTimer = setTimeout(function() {
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

  setTimeout(function() {
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
    stream.getTracks().forEach(function(track) { track.stop(); });
    stream = null;
  }
}

// 初期化
startCamera();