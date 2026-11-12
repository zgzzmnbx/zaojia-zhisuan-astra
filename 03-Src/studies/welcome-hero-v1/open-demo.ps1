param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$node = (Get-Command node -ErrorAction Stop).Source
$url = 'http://127.0.0.1:5197/'
$existing = Get-NetTCPConnection -LocalPort 5197 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $page = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing
    if ($page.Content -notmatch '欢迎页设计 Demo') { throw '5197 端口由其他服务占用，未更改该服务。' }
} else {
    $entry = Join-Path $project '04-output/welcome-hero-demo-v1.1.0/03-Src/studies/welcome-hero-v1/index.html'
    if (-not (Test-Path -LiteralPath $entry)) {
        Push-Location -LiteralPath $project
        try {
            & $node 'node_modules/vite/bin/vite.js' build --config '03-Src/studies/welcome-hero-v1/vite.config.mjs'
            if ($LASTEXITCODE -ne 0) { throw 'Demo 构建失败。' }
        } finally { Pop-Location }
    }
    $logDir = Join-Path $project 'Codex-Temp/welcome-hero-v1'
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $server = Join-Path $PSScriptRoot 'serve.mjs'
    $process = Start-Process -FilePath $node -ArgumentList @('"' + $server + '"') -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "$stamp-stdout.log") -RedirectStandardError (Join-Path $logDir "$stamp-stderr.log") -PassThru
    $process.Id | Set-Content -LiteralPath (Join-Path $logDir "$stamp-server.pid")
    $loaded = $false
    for ($i=0;$i -lt 20;$i++) {
        try { $page = Invoke-WebRequest -Uri $url -TimeoutSec 1 -UseBasicParsing; if($page.Content -match '欢迎页设计 Demo'){$loaded=$true;break} } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $loaded) { throw 'Demo 未正常启动，请查看 Codex-Temp/welcome-hero-v1 日志。' }
}
if (-not $NoBrowser) { Start-Process $url }
