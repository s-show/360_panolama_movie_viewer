# 360度写真 & 動画ビューワー

Three.js を使用した360度パノラマ画像/動画のビューワーです。テキストラベルや矢印のアノテーションを追加でき、アノテーション付きのエクイレクタングラー画像としてエクスポートできます。

## 機能

- 360度パノラマ画像（JPEG / PNG / GIF / BMP）の表示
- 360度動画（MP4 / WebM / FLV）の再生
- マウス操作による視点の回転・ズーム・パン
- テキストラベルの配置（色・サイズ変更可）
- 矢印アノテーションの配置（色変更可）
- アノテーションの選択・移動・回転・削除
- エクイレクタングラー画像としてエクスポート（JPEG / PNG）

## 使い方

### 画像/動画の読み込み

画面下部の「ファイルを選択」ボタンから360度パノラマ画像または動画を選択します。

### 視点操作

| 操作 | 動作 |
|------|------|
| 左ドラッグ | 視点回転 |
| ホイール | ズーム |
| 右ドラッグ | パン |
| 「視点初期化」ボタン | 視点をリセット |

### アノテーション（画像モードのみ）

1. ラベル入力欄にテキストを入力
2. 「テキスト: OFF」ボタンをクリックして ON に切り替え
3. パノラマ上の配置したい位置をクリック

矢印も同様に「矢印: OFF」ボタンを ON にしてから、始点をドラッグして終点で離すと配置されます。

配置済みのアノテーションをクリックすると編集パネルが表示され、テキスト・色・サイズの変更や削除が可能です。

### 動画操作

| 操作 | 動作 |
|------|------|
| Space | 再生/一時停止 |
| 左矢印キー | 10秒巻き戻し |
| 右矢印キー | 10秒早送り |
| パノラマクリック | 再生/一時停止 |

### 画像エクスポート

画像モード時に画面下部のフォーマット（JPEG / PNG）を選択し、「画像保存」ボタンをクリックするとアノテーション付きのエクイレクタングラー画像がダウンロードされます。出力解像度は元画像と同じです。

## ダウンロード

[Releases](../../releases) ページからビルド済みの `index.html` をダウンロードできます。単一の HTML ファイルなのでブラウザで直接開くだけで使用できます。

## 開発

### 必要環境

- Node.js 20 以上
- pnpm

> Nix flake + direnv による開発環境も用意しています（`flake.nix`）。

### セットアップ

```bash
pnpm install
```

### コマンド

| コマンド | 説明 |
|----------|------|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | プロダクションビルド（単一 HTML ファイル出力） |
| `pnpm preview` | ビルド結果のプレビュー |

### ビルド

`pnpm build` を実行すると `dist/index.html` に全 JS/CSS がインライン化された単一 HTML ファイルが生成されます（`vite-plugin-singlefile` 使用）。

### プロジェクト構成

```
src/
  main.js                  エントリポイント
  style.scss               スタイル
  annotations/
    annotationFactory.js   テキストスプライト・矢印メッシュの生成
    annotationStore.js     描画オブジェクトのリスト管理
  exporter/
    equirectExporter.js    エクイレクタングラー画像エクスポート
  media/
    mediaDetector.js       ファイル種別判定
    mediaLoader.js         テクスチャ生成
    videoControls.js       動画再生制御
  state/
    editorState.js         エディタ状態管理
    mediaState.js          メディア状態管理
  ui/
    icons.js               SVG アイコン定義
    uiController.js        UI イベントハンドラ
  utils/
    canvasText.js          Canvas テキスト描画ヘルパー
    math.js                数値ユーティリティ
  viewer/
    Viewer.js              Scene / Camera / Renderer / Controls 管理
index.html                 UI 定義
vite.config.js             Vite 設定
```

### リリース

`v*` パターンのタグを push すると GitHub Actions が自動でビルドし、Release に `index.html` を添付します。

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 技術スタック

- [Three.js](https://threejs.org/) — 3D レンダリング
- [Vite](https://vite.dev/) — ビルドツール
- [vite-plugin-singlefile](https://github.com/nickcox/vite-plugin-singlefile) — 単一 HTML 出力

## ライセンス

MIT
