$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

function Test-Command($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "node")) {
  Write-Host "Node.jsをインストールしています…"
  if (-not (Test-Command "winget")) {
    throw "Node.jsが見つかりません。Microsoft Storeから『アプリ インストーラー』を導入してから、もう一度起動してください。"
  }

  winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "Node.jsのインストールに失敗しました。"
  }

  $nodeDirectory = Join-Path $env:ProgramFiles "nodejs"
  if (Test-Path (Join-Path $nodeDirectory "node.exe")) {
    $env:Path = "$nodeDirectory;$env:Path"
  }
}

if (-not (Test-Command "node")) {
  throw "Node.jsをインストールしましたが、この画面から見つけられません。Windowsを再起動してから、もう一度起動してください。"
}

Write-Host "依存ライブラリを確認しています…"
if (Test-Command "corepack") {
  corepack pnpm install --frozen-lockfile
} else {
  npm install --global pnpm@11.19.0
  pnpm install --frozen-lockfile
}

if ($LASTEXITCODE -ne 0) {
  throw "依存ライブラリのインストールに失敗しました。"
}

Write-Host "アプリを起動しています…"
if (Test-Command "corepack") {
  corepack pnpm run dev
} else {
  pnpm run dev
}
