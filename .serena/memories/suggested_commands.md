# 推奨コマンド

## 開発コマンド

### 開発サーバー起動
```bash
pnpm dev
```
Vite開発サーバーを起動。ホットリロード対応。

### 本番ビルド
```bash
pnpm build
```
`dist/index.html`に単一HTMLファイルを出力。

### ビルドプレビュー
```bash
pnpm preview
```
ビルド結果をローカルでプレビュー。

## システムコマンド (Linux)

### ファイル操作
```bash
ls -la                    # ファイル一覧
cd <dir>                  # ディレクトリ移動
find . -name "*.js"       # ファイル検索
```

### Git操作
```bash
git status                # 状態確認
git diff                  # 差分確認
git add <file>            # ステージング
git commit -m "message"   # コミット
git log --oneline         # ログ表示
```

### パッケージ管理
```bash
pnpm install              # 依存関係インストール
pnpm add <package>        # パッケージ追加
pnpm remove <package>     # パッケージ削除
```

## 注意
- pnpmが推奨だがnpmも使用可
- Node.js 20推奨（flake.nixで定義）
