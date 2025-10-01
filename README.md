# 実装ガイド（デプロイ版）

---

## 実行方法

Node.js（npm）が未インストールなら先にインストールする。

```jsonc
cd back-end  （またはback-endでターミナルを開く）
npm i express nodemon
npm run dev  （これでサーバー起動）
```

---

## 機能一覧 (実装済)
| カテゴリ | 機能 |
|----------|------|
| 残高管理 | ID 指定で加算 / 減算。結果ポップアップ (新残高 + 差分 ±X) / 入力フォーム自動リセット |
| ランキング | 残高降順自動更新 (ポーリング)。Top3 を 2位,1位,3位 の DOM 順で再配置し既存 CSS 適用 |
| 取引履歴 | 周期取得 → 変更検出 (ハッシュ) 時のみ tbody 差し替え |
| ダッシュボード統計 | アクティブID数 / 合計残高 / 当日取引件数 表示・自動更新 |
| QR スキャン | カメラ映像からユーザーIDデコード → 即残高取得表示 |
| テーマ | ライト / ダーク。初回: LocalStorage > OS 設定。逆テーマを prefetch で先読み |
| 数値アニメ | 残高値など 500ms アニメーション |
| エラーハンドリング | 共通 `handleApiError` で UI+ログ整形 |
| 共通ユーティリティ | `common.js` に集中 (fetch / format / popup / selectors / intervals) |
| アクセシビリティ | focus-visible 対応ラジオ / ポップアップ role="alert" / キーボード操作 (Enter, ESC) |

---

## データ (実際に参照する JSON 構造)
### users.json
```jsonc
[{ "id": "<ID>", "balance": 12345, "createdAt": "ISO8601" }]
```
### history.json
```jsonc
[{ "timestamp": "ISO8601", "id": "<ID>", "games": "<game>", "type": "add"|"subtract", "amount": 300, "balance": 5300, "dealer": "<dealer>" }]
```
### ranking.json
```jsonc
[{ "id": "<ID>", "balance": 9999 }] // balance 降順
```

---

## 画面別の使い方
| ページ | 目的 | 主 JS |
|--------|------|-------|
| balance-updater.html | 残高加算 / 減算 | balanceUpdater.js |
| dashboard.html | 統計サマリ表示 | informationUpdater.js |
| ranking.html | ランキング閲覧 | rankingUpdater.js |
| transaction-history.html | 取引履歴閲覧 | historyUpdater.js |
| settings.html | テーマ切替 / 設定 | theme.js + common.js |
| balance-checker.html | QR でID取得 / 残高表示 | balanceChecker.js |

基本フロー (加算 / 減算):
1. ID 入力 (または QR 読み取り) → 有効な残高表示
2. 金額 + ゲーム種別 + Dealer 入力
3. Add / Subtract ボタン活性化 (自動判定)
4. 送信 → ポップアップ表示 (新残高 & 差分) → ランキング/履歴/統計は各ポーリングで追随

---

## ディレクトリ構造 (全体)
```
./
  back-end/                         # バックエンド一式
    package.json                    # 依存 & npm スクリプト
    package-lock.json               # 依存固定
    server.js                       # Express API サーバ本体
  data/                             # 永続 JSON データ
    users.json                      # ユーザー残高 (ソース)
    ranking.json                    # ソート済み派生ランキング
    history.json                    # 取引履歴 (新→旧順)
  front-end/                        # フロントエンド一式
    README.md                       # このドキュメント
    balance-checker.html            # 残高確認ページ
    balance-updater.html            # 残高更新ページ
    dashboard.html                  # ダッシュボードページ
    ranking.html                    # ランキングページ
    settings.html                   # 設定ページ
    transaction-history.html        # 取引履歴ページ
    css/                            # cssファイル（スタイル）
      balance-updater.css           # 残高更新ページ用スタイル
      base.css                      # 基本スタイル
      components.css                # コンポーネントスタイル
      dark-theme.css                # ダークテーマ変数
      layout.css                    #レイアウト関連スタイル
      light-theme.css               # ライトテーマ変数
      mobile.css                    # モバイル向け調整
      navigation.css                #ナビゲーションスタイル
      pages.css                     #ページ固有スタイル
      qrScanner.css                 # QR スキャナ UI
      settings.css                  # 設定画面調整
      tablet.css                    # タブレット調整
      transaction-history.css       # 履歴表スタイル
    js/                             # フロント JS
      balanceChecker.js             # QR 読取 & 残高取得
      balanceUpdater.js             # 加算/減算ロジック
      common.js                     # 共通ユーティリティ集約
      historyUpdater.js             # 履歴ポーリング描画
      informationUpdater.js         # 統計取得更新
      jsQR.js                       # 外部 QR ライブラリ
      rankingUpdater.js             # ランキング更新処理
      slideIn.js                    # スライドイン UI 効果
      tabControl.js                 # タブ切替制御
      theme.js                      # テーマ初期化/切替
      userAdder.js                  # ユーザー追加フォーム制御
    svg/                            # アイコン
      add_circle.svg
      close.svg
      crown.svg
      currency_exchange.svg
      dehaze.svg
      finance.svg
      history.svg
      info.svg
      library_add.svg
      open_in_new.svg
      qr_code.svg
      qr_code_scanner.svg
      remove.svg
      request_quote.svg
      settings.svg
      supervisor_account.svg
      svg.html                      # SVG プレビュー用
      sync_alt.svg
      wallet.svg
  .git/                             # Git メタデータ
```

## 共通ユーティリティ概要 (`common.js`)
| 関数 | 役割 |
|------|------|
| fetchJSON | no-cache 取得 (timestamp 付与) |
| animateValue | 数値アニメ (duration, easing) |
| formatDateTime | 日時表示整形 |
| updateBalanceButtons | 入力状態から Add/Subtract 有効化管理 |
| showPopup / showBalanceUpdatePopup | ポップアップ表示 (多重抑止) |
| showInlineMessage / clearInlineMessage | インライン通知 |
| arrangeTop3 | 上位3行の DOM 並び替え |
| handleApiError | 共通エラー整形 |
| POLL_INTERVALS | ランキング / 履歴 / 統計 ポーリング間隔 |
| selectors | querySelector 集約マップ |

---

## テーマ (`theme.js`)
| 振る舞い | 詳細 |
|----------|------|
| 初期決定 | localStorage > OS (prefers-color-scheme) > light |
| 変更 | ThemeManager.setTheme('light'|'dark') |
| 先読み | 逆テーマ CSS を link rel=prefetch |
| FOUC 対策 | 初期 script 早期実行でクラス付与 |

---

## API エンドポイント
| Method | Path | 説明 |
|--------|------|------|
| POST | /api/add | 残高加算 |
| POST | /api/subtract | 残高減算 |
| GET | /api/balance/:id | 指定ID残高取得 |
| GET | /api/history | 取引履歴一覧 |
| GET | /api/ranking | 残高ランキング |
| GET | /api/dashboard-stats | 統計 (activeIds,totalBalance,totalTransactions) |
| POST | /api/users | ユーザー追加 (ID 任意 / 自動生成) |

---

## セットアップ
1. back-end ディレクトリで依存インストール: `npm install`
2. サーバ起動: `node server.js` (PORT=3000 など任意)
3. ブラウザで `http://localhost:3000/dashboard.html` などを開く

---

## 手動確認チェック (抜粋)
| ケース | 期待 |
|--------|------|
| Add / Subtract | ポップアップ表示 + 差分 ±X + 入力リセット |
| ランキング反映 | 数秒後に順位更新 / Top3 並び保持 |
| 履歴更新なし | 変更なければ DOM 再構築なし |
| テーマ切替 | 即反映 / チラつき無し |
| QR 読み取り | ID 自動入力 → 残高取得成功 |

---

## トラブルシューティング (主要)
| 症状 | 対処 |
|------|------|
| テーマが点滅する | `<script src="js/theme.js">` を <head> 早期読込 |
| ランキング更新停止 | Network / Console で /api/ranking 失敗確認し JSON 修正 |
| QR 読めない | 光量 / カメラ許可 (HTTPS 必須) |
| ポップアップ多重 | `showBalanceUpdatePopup` のみ使用 |

---

## コーディング規約 (抜粋)
| 項目 | 規約 |
|------|------|
| JS命名 | lowerCamelCase |
| CSSクラス | kebab-case |
| 定数 | UPPER_SNAKE (局所除く) |
| DOM取得 | selectors 経由を優先 |
| エラー表示 | 重複ログ禁止 (共通ハンドラ) |
| コメント | 目的 / 副作用 / 返り値 簡潔 |

---

## セキュリティ / 注意
| 項目 | 内容 |
|------|------|
| 入力エスケープ | 履歴描画時にサニタイズ済み |
| 競合書き込み | JSON 直書きのため同時更新は注意 (必要ならロック拡張) |
| HTTPS | カメラ利用時に必須 (本番) |

---

## 使用外部ライブラリ
- jsQR (QRコード解析)

---

## ライセンス
内部利用想定 (外部公開時は MIT 等を検討)。

