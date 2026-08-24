#!/bin/zsh
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.jsをインストールしています…"
  if ! command -v brew >/dev/null 2>&1; then
    echo "Node.jsが見つかりません。Homebrewを導入してから、もう一度起動してください。"
    read "?Enterキーを押して終了します。"
    exit 1
  fi
  brew install node
fi

echo "依存ライブラリを確認しています…"
if command -v corepack >/dev/null 2>&1; then
  corepack pnpm install --frozen-lockfile
  echo "アプリを起動しています…"
  exec corepack pnpm run dev
else
  npm install --global pnpm@11.19.0
  pnpm install --frozen-lockfile
  echo "アプリを起動しています…"
  exec pnpm run dev
fi
