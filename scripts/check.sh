#!/usr/bin/env bash
# ローカルと CI で共用する検証入口。
# 対話入力を求めず、成功時は終了コード 0、失敗時は非 0 を返す。
#
#   ./scripts/check.sh          全部実行
#   SKIP_E2E=1 ./scripts/check.sh   E2E を飛ばす（ブラウザが無い環境向け）

set -euo pipefail

cd "$(dirname "$0")/.."

run() {
  echo ""
  echo "==> $*"
  "$@"
}

# 1. lockfile どおりに依存を入れる（lockfile と package.json の不整合もここで落ちる）
run pnpm install --frozen-lockfile

# 2. 静的解析
run pnpm lint

# 3. 単体テスト
run pnpm test

# 4. 配布物のビルド（単一 HTML）
run pnpm build

# 5. E2E（ビルド済みの dist/index.html を preview 配信して実行）
if [ "${SKIP_E2E:-0}" = "1" ]; then
  echo ""
  echo "==> SKIP_E2E=1 のため E2E をスキップしました"
else
  run pnpm test:e2e
fi

echo ""
echo "==> すべての検証に成功しました"
