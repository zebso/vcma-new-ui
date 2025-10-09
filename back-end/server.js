"use strict";
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const https = require('https');

const PORT = 3000;
// const HOST = '10.16.243.159';
const HOST = '192.168.10.113';

const options = {
  key: fs.readFileSync("../ssl/key.pem"),
  cert: fs.readFileSync("../ssl/cert.pem"),
};

app.use(express.json());
app.use(express.static(path.join(__dirname, '../front-end')));

const usersFile = path.join(__dirname, '../data', 'users.json');
const historyFile = path.join(__dirname, '../data', 'history.json');
const rankingFile = path.join(__dirname, '../data', 'ranking.json');

// ユーティリティ関数（空ファイル/欠損に耐性）
const loadJSON = file => {
  try {
    const txt = fs.readFileSync(file, 'utf-8');
    return txt.trim() ? JSON.parse(txt) : [];
  } catch (e) {
    return [];
  }
};
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ユーザーID自動生成 (重複回避は呼出側で再試行)
const generateUserId = () => {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return `CC-${year}-${rand}`;
};

// ランキング更新: users.json から都度再構築（シンプル & 一貫性）
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

//残高取得API
app.get('/api/balance/:id', (req, res) => {
  const users = loadJSON(usersFile);
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'ID not found' });
  res.json({ id: user.id, balance: user.balance, exchangeableBalance: user.exchangeableBalance })
});

// 共通トランザクション処理
const createTransactionHandler = type => {
  return (req, res) => {
    const { id, amount, games } = req.body || {};
    const num = Number(amount);

    // 最低限のバリデーション（フロントと挙動変えない: エラー時 success:false ではなく既存通りエラーレスポンス）
    if (!id || isNaN(num) || num <= 0) {
      return res.status(400).json({ error: 'invalid request' });
    }

    const users = loadJSON(usersFile);
    const history = loadJSON(historyFile);
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'ID not found' });

    // 商品交換時の出金はランキングに表示されるポイント数を変更しない
    if (!(games === 'exchange' && type === 'subtract')) {
      user.balance += type === 'add' ? num : -num; // 加算 or 減算
    }
    user.exchangeableBalance += type === 'add' ? num : -num; // 出金可能残高を更新

    history.unshift({
      timestamp: new Date().toISOString(),
      id,
      games,
      type,
      amount: num, // 常に正数で保存
      balance: user.balance,
      exchangeableBalance: user.exchangeableBalance
    });

    saveJSON(usersFile, users);
    saveJSON(historyFile, history);
    updateRanking();

    res.json({ success: true, balance: user.balance, exchangeableBalance: user.exchangeableBalance });
  };
}

// 入金API / 出金API （挙動・レスポンス互換）
app.post('/api/add', createTransactionHandler('add'));
app.post('/api/subtract', createTransactionHandler('subtract'));

// 履歴取得API
app.get('/api/history', (req, res) => {
  const history = loadJSON(historyFile);
  res.json(history);
});

app.get('/api/ranking', (req, res) => {
  const ranking = loadJSON(rankingFile);
  res.json(ranking);
});

// ユーザー追加 API
// Body: { id?:string, balance?:number }
// id 未指定時はサーバ側で自動生成 (重複回避ループ)
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
      // 重複しない ID を生成
      do { newId = generateUserId(); } while (users.some(u => u.id === newId));
    }
    let bal = Number(balance);
    if (isNaN(bal) || bal < 0) bal = 0;
    bal = Math.floor(bal);
    const user = { id: newId, balance: bal, createdAt: new Date().toISOString() };
    users.push(user);
    saveJSON(usersFile, users);
    // 生成イベントを履歴に追加 (type: generate, amount = 初期残高, dealer/games は空)
    history.unshift({
      timestamp: new Date().toISOString(),
      id: user.id,
      games: '',
      type: 'generate',
      amount: user.balance,
      balance: user.balance,
      exchangeableBalance: user.balance
    });
    saveJSON(historyFile, history);
    updateRanking();
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: 'failed to create user' });
  }
});

// ダッシュボード統計API（必要最小限の値のみ返却）
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


//ページの表示

//ユーザーページへ推移
app.get('/', (req, res) => {
  res.redirect('/user');
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, '../front-end/pages', 'user.html'));
});

app.get('/dealer', (req, res) => {
  res.sendFile(path.join(__dirname, '../front-end/pages', 'dealer.html'));
});

//サーバー立ち上げ
// app.listen(process.env.PORT || PORT, () => {
//   console.log(`The server started on port ${PORT}`);
//   console.log(`Local server is running at http://localhost:${PORT}/`);
//   console.log(`Network server is running at http://${HOST}:${PORT}/`);
// });

https.createServer(options, app).listen(PORT, HOST, () => {
  console.log(`✅ HTTPS server started at https://${HOST}:${PORT}`);
});