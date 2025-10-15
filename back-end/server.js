"use strict";
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const app = express();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
// const HOST = '10.16.246.184';
const HOST = process.env.HOST || 'localhost';

// ゲーム別の上限設定
const GAME_LIMITS = {
  'poker': 500,
  'blackjack': 400,
  'roulette': 300,
  'ring-toss': 200,
  'shooting': 200,
  'exchange': 1000, // 商品交換は1IDあたりの上限
  // デフォルト（ゲーム指定なし）
  'default': 100
};

// --- Paths ---
const ROOT = path.resolve(__dirname, '..');
const FRONT_DIR = path.join(ROOT, 'front-end');
const DATA_DIR = path.join(ROOT, 'data');
const SSL_DIR = path.join(ROOT, 'ssl');
const KEY_PATH = path.join(SSL_DIR, 'key.pem');
const CERT_PATH = path.join(SSL_DIR, 'cert.pem');

// Ensure data dir exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// --- Middlewares ---
app.use(express.json());
app.use(express.static(FRONT_DIR));

// --- Files ---
const usersFile = path.join(DATA_DIR, 'users.json');
const historyFile = path.join(DATA_DIR, 'history.json');
const rankingFile = path.join(DATA_DIR, 'ranking.json');

// --- Utils ---
const loadJSON = file => {
  try {
    const txt = fs.readFileSync(file, 'utf-8');
    return txt.trim() ? JSON.parse(txt) : [];
  } catch (e) {
    return [];
  }
};
const saveJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

const generateUserId = () => {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return `CC-${year}-${rand}`;
};

const updateRanking = () => {
  try {
    const users = loadJSON(usersFile);
    const ranking = users
      .map(u => ({ id: u.id, balance: Number(u.balance || 0) }))
      .sort((a, b) => b.balance - a.balance);
    saveJSON(rankingFile, ranking);
  } catch (e) {
    console.error('ランキング更新エラー:', e);
  }
};

// --- APIs ---
app.get('/api/balance/:id', (req, res) => {
  const users = loadJSON(usersFile);
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'ID not found' });
  // 安全な既定値
  if (typeof user.exchangedAmount !== 'number') {
    user.exchangedAmount = Number(user.exchangedAmount || 0);
    saveJSON(usersFile, users);
  }
  res.json({ id: user.id, balance: user.balance, exchangedAmount: user.exchangedAmount })
});

const createTransactionHandler = type => {
  return (req, res) => {
    const { id, amount, games } = req.body || {};
    const num = Number(amount);
    if (!id || isNaN(num) || num <= 0) {
      return res.status(400).json({ error: 'invalid request' });
    }

    const users = loadJSON(usersFile);
    const history = loadJSON(historyFile);
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'ID not found' });

    // 減算時のゲーム別上限チェック
    if (type === 'subtract') {
      // 残高を超える場合はエラー
      if (num > user.balance) {
        return res.status(400).json({ error: '残高不足です' });
      }

      if (games === 'exchange') {
        if (user.exchangedAmount >= GAME_LIMITS['exchange']) {
          return res.status(400).json({
            error: `1人当たりの交換可能ポイント数${GAME_LIMITS['exchange'].toLocaleString()}を超えています`
          });
        }
      } else {
        const gameType = games || 'default';
        const limit = GAME_LIMITS[gameType] || GAME_LIMITS['default'];

        if (num > limit) {
          return res.status(400).json({
            error: `${gameType}の上限額${limit.toLocaleString()}を超えています`
          });
        }
      }
    }

    // 減算時のゲーム別上限チェック
    if (type === 'subtract') {
      if (games === 'exchange') {
        if (user.exchangedAmount >= GAME_LIMITS['exchange']) {
          return res.status(400).json({
            error: `1人当たりの交換可能ポイント数${GAME_LIMITS['exchange'].toLocaleString()}を超えています`
          });
        }
      } else {
        const gameType = games || 'default';
        const limit = GAME_LIMITS[gameType] || GAME_LIMITS['default'];

        if (num > limit) {
          return res.status(400).json({
            error: `${gameType}の上限額${limit.toLocaleString()}を超えています`
          });
        }
      }
    }

    // 既定値（未定義対策）
    if (typeof user.exchangedAmount !== 'number') {
      user.exchangedAmount = Number(user.exchangedAmount || user.balance || 0);
    }

    // 商品交換時の出金はランキング対象 balance を変えない
    if (!(games === 'exchange' && type === 'subtract')) {
      user.balance += type === 'add' ? num : -num;
    }

    if (games === 'exchange' && type === 'subtract') {
      user.exchangedAmount += num; // 商品交換済みポイントを更新
    }

    history.unshift({
      timestamp: new Date().toISOString(),
      id,
      games,
      type,
      amount: num,
      balance: user.balance,
      exchangedAmount: user.exchangedAmount
    });

    saveJSON(usersFile, users);
    saveJSON(historyFile, history);
    updateRanking();

    res.json({ success: true, balance: user.balance, exchangedAmount: user.exchangedAmount });
  };
};

app.post('/api/add', createTransactionHandler('add'));
app.post('/api/subtract', createTransactionHandler('subtract'));

app.get('/api/history', (req, res) => {
  const history = loadJSON(historyFile);
  res.json(history);
});

app.get('/api/ranking', (req, res) => {
  const ranking = loadJSON(rankingFile);
  res.json(ranking);
});

app.post('/api/users', (req, res) => {
  try {
    const { id, balance } = req.body || {};
    const users = loadJSON(usersFile);
    const history = loadJSON(historyFile);

    let newId = (id || '').trim();
    if (newId) {
      if (users.some(u => u.id === newId)) {
        return res.status(409).json({ error: 'id exists' });
      }
    } else {
      do { newId = generateUserId(); } while (users.some(u => u.id === newId));
    }

    let bal = Number(balance);
    if (isNaN(bal) || bal < 0) bal = 0;
    bal = Math.floor(bal);

    const user = { id: newId, balance: bal, exchangedAmount: 0, createdAt: new Date().toISOString() };
    users.push(user);
    saveJSON(usersFile, users);

    history.unshift({
      timestamp: new Date().toISOString(),
      id: user.id,
      games: '',
      type: 'generate',
      amount: user.balance,
      balance: user.balance,
      exchangedAmount: 0
    });
    saveJSON(historyFile, history);
    updateRanking();

    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: 'failed to create user' });
  }
});

app.get('/api/dashboard-stats', (req, res) => {
  try {
    const users = loadJSON(usersFile);
    const history = loadJSON(historyFile);
    res.json({
      activeIds: users.length,
      totalBalance: users.reduce((sum, u) => sum + Number(u.balance || 0), 0),
      totalTransactions: history.length
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to compute stats' });
  }
});

// --- Pages ---
app.get('/', (req, res) => res.redirect('/dealer'));
app.get('/user', (req, res) => res.sendFile(path.join(FRONT_DIR, 'pages', 'user.html')));
app.get('/dealer', (req, res) => res.sendFile(path.join(FRONT_DIR, 'pages', 'dealer.html')));

// --- Server bootstrap (HTTPS if certs exist, else HTTP) ---
const hasSSL = fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH);
if (hasSSL) {
  const options = {
    key: fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH),
  };
  https.createServer(options, app).listen(PORT, HOST, () => {
    console.log(`✅ HTTPS server started at https://${HOST}:${PORT}`);
  });
} else {
  http.createServer(app).listen(PORT, HOST, () => {
    console.log('⚠️  SSL cert not found. Started HTTP server instead.');
    console.log(`➡️  http://${HOST}:${PORT}/dealer`);
    console.log(`   To enable HTTPS, place key.pem and cert.pem under: ${SSL_DIR}`);
  });
}

// --- PWA manifest / service worker routes ---
app.get('/manifest/manifest.json', (req, res) => {
  res.sendFile(path.join(FRONT_DIR, 'manifest', 'manifest.json'));
});

app.get('/service-worker.js', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(FRONT_DIR, 'js', 'service-worker.js'));
});

// static の後あたりに追加
app.get('/offline.html', (req, res) => {
  res.sendFile(path.join(FRONT_DIR, 'pages', 'offline.html'));
});