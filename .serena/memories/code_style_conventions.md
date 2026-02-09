# コードスタイル・規約

## ESLint設定 (`.eslint.json`)
- **セミコロン**: 必須 (`"semi": ["error", "always"]`)
- **クォート**: ダブルクォート必須 (`"quotes": ["error", "double"]`)
- **環境**: browser, es2021, node
- **ECMAバージョン**: ES12
- **モジュール**: ES modules

## ファイル構成規約
- 1モジュール = 1責任
- 関連機能はディレクトリでグループ化
- エクスポートは名前付きエクスポートを使用

## 命名規約
- **関数/変数**: camelCase (`createTextSprite`, `selectedObject`)
- **クラス**: PascalCase (`Viewer`)
- **定数**: camelCase（シェーダー文字列など）
- **ファイル**: camelCase (`annotationFactory.js`)

## Three.js関連
- カスタムオブジェクトに`type`プロパティを付与して識別
- スプライトに`baseScale`, `text`, `color`などのカスタムプロパティを設定
- リソース解放は`dispose()`メソッドで明示的に行う

## スタイル (Sass)
- `src/style.scss`に全スタイルを集約
- Viteの組み込みSassサポートを使用

## コメント
- 日本語コメント可
- 必要最小限のコメント
