# コードベース構造

## ディレクトリ構成
```
src/
├── main.js                 # エントリーポイント、イベントハンドラ接続
├── style.scss              # 全スタイル定義
├── viewer/
│   └── Viewer.js           # Three.jsビューワークラス（シーン、カメラ、レンダラー、コントロール）
├── annotations/
│   ├── annotationFactory.js # createTextSprite(), createArrowMesh(), updateTextSpriteContent()
│   └── annotationStore.js   # アノテーション管理（add, remove, clear, getAll, reset）
├── state/
│   ├── editorState.js       # エディタ状態（currentMode, selectedObject, arrowStartPoint, isDraggingGizmo）
│   └── mediaState.js        # メディア状態
├── ui/
│   ├── uiController.js      # UI操作ハンドラ、プロパティパネル制御
│   └── icons.js             # SVGアイコン定義
├── media/
│   ├── mediaDetector.js     # detectFileType() - マジックバイトでファイルタイプ判定
│   ├── mediaLoader.js       # createTexture() - テクスチャ/ビデオテクスチャ生成
│   └── videoControls.js     # 動画再生コントロール
├── exporter/
│   └── equirectExporter.js  # saveEquirectangularImage() - エクイレクタングラー画像エクスポート
└── utils/
    ├── math.js              # 数学ユーティリティ
    └── canvasText.js        # キャンバステキスト処理

index.html                   # HTML（UI要素定義）
vite.config.js               # Vite設定（singlefileプラグイン）
```

## 主要クラス/関数

### Viewerクラス (`src/viewer/Viewer.js`)
- `init()` - シーン初期化
- `addObject(obj)` / `removeObject(obj)` - オブジェクト管理
- `checkIntersection(x, y)` - レイキャスト（選択）
- `getIntersectPoint(x, y)` - レイキャスト（配置位置取得）
- `tick()` - アニメーションループ
- `dispose()` - リソース解放

### アノテーションファクトリ (`src/annotations/annotationFactory.js`)
- `createTextSprite(text, position, color)` - テキストスプライト生成
- `createArrowMesh(start, end, color)` - 矢印メッシュ生成
- `updateTextSpriteContent(sprite, text, scale)` - テキスト更新

### エクスポーター (`src/exporter/equirectExporter.js`)
- `saveEquirectangularImage(scene, renderer, format)` - CubeCamera→シェーダー→PNG/JPEG

## モード
エディタモード（`editorState.currentMode`）:
- `'none'` - 通常表示
- `'text'` - テキスト追加モード
- `'arrow'` - 矢印追加モード
