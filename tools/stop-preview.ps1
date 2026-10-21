param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'

function Get-AstraLaunchRoot([string]$BaseRoot) {
    $configPath = Join-Path $BaseRoot 'config/astra-launch.local.json'
    if (Test-Path -LiteralPath $configPath) {
        $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if (-not $config.workspace) { throw 'Launcher config is missing workspace.' }
        $candidate = [string]$config.workspace
        if (-not [IO.Path]::IsPathRooted($candidate)) { $candidate = Join-Path $BaseRoot $candidate }
    } else { $candidate = $BaseRoot }
    $root = (Resolve-Path -LiteralPath $candidate).Path
    foreach ($required in @('tools/run_server.py', 'package.json')) {
        if (-not (Test-Path -LiteralPath (Join-Path $root $required))) { throw "Invalid Astra workspace: $root" }
    }
    return $root
}

function Get-AstraListener {
    return Get-NetTCPConnection -LocalPort 5189 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

function ConvertFrom-AstraHealthResponse($Response) {
    if (-not $Response.RawContentStream) { throw 'Health response bytes are missing.' }
    $json = [Text.Encoding]::UTF8.GetString($Response.RawContentStream.ToArray())
    return $json | ConvertFrom-Json
}

function Test-AstraServicePid([string]$WorkspaceRoot, [int]$ProcessId) {
    $pidFile = Join-Path $WorkspaceRoot 'Codex-Temp/server.pid'
    if (Test-Path -LiteralPath $pidFile) {
        $recorded = (Get-Content -LiteralPath $pidFile -Raw).Trim()
        if ($recorded -eq [string]$ProcessId) { return $true }
    }
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5189/api/health' -TimeoutSec 2
        $health = ConvertFrom-AstraHealthResponse $response
        return ($health.status -eq 'ok' -and $health.service -eq 'zhisuan-astra' -and
            $health.workspace -and [IO.Path]::GetFullPath($health.workspace) -eq [IO.Path]::GetFullPath($WorkspaceRoot) -and
            [int]$health.pid -eq $ProcessId)
    } catch { return $false }
}

function Invoke-AstraStop {
    $baseRoot = Split-Path $PSScriptRoot -Parent
    $root = Get-AstraLaunchRoot $baseRoot
    Write-Host "Workspace: $root"
    $listener = Get-AstraListener
    if (-not $listener) {
        Write-Host 'Astra is not running.'
        return
    }
    $serverPid = [int]$listener.OwningProcess
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid"
    $isServer = $owner -and $owner.CommandLine -and ($owner.CommandLine -like '*tools/run_server.py*')
    if (-not $isServer -or -not (Test-AstraServicePid $root $serverPid)) {
        throw 'Port 5189 belongs to a different workspace or service. Nothing was stopped.'
    }
    if ($CheckOnly) {
        Write-Host "Astra is running (PID $serverPid)."
        return
    }
    Stop-Process -Id $serverPid
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 300
        if (-not (Get-AstraListener)) {
            Write-Host "Astra stopped (PID $serverPid)."
            return
        }
    }
    throw "Astra process $serverPid did not release port 5189. Check the process manually."
}

try {
    Invoke-AstraStop
    exit 0
} catch {
    Write-Host "STOP FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
