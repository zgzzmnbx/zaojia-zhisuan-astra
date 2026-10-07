param([switch]$NoBrowser, [switch]$CheckOnly)
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

function Test-AstraOwner([string]$CommandLine, [string]$PythonPath) {
    # Require the selected workspace's interpreter, not merely a matching app name.
    return $CommandLine -and $CommandLine.StartsWith(('"' + $PythonPath + '"'), [StringComparison]::OrdinalIgnoreCase) -and
        $CommandLine.Contains('tools/run_server.py')
}

function Get-AstraListener {
    return Get-NetTCPConnection -LocalPort 5189 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Test-AstraReady {
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5189/api/health' -TimeoutSec 2
        return $health.status -eq 'ok' -and $health.service -eq 'zhisuan-astra' -and $health.isolated -eq $true
    } catch { return $false }
}

function Invoke-AstraPreview {
    $baseRoot = Split-Path $PSScriptRoot -Parent
    $root = Get-AstraLaunchRoot $baseRoot
    $pythonPath = Join-Path $root '.venv/Scripts/python.exe'
    $pythonPath = [IO.Path]::GetFullPath($pythonPath)
    Write-Host "Workspace: $root"
    $listener = Get-AstraListener
    if ($listener) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if (-not (Test-AstraOwner $owner.CommandLine $pythonPath)) {
            throw 'Port 5189 belongs to a different workspace or service. Nothing was stopped. Check config/astra-launch.local.json.'
        }
        if (-not (Test-AstraReady)) { throw 'Astra is running but not ready. Check its server log; no process was restarted.' }
        Write-Host 'Astra is already running. Reusing the existing service.'
    } else {
        if ($CheckOnly) { throw 'Astra is not running.' }
        if (-not (Test-Path -LiteralPath $pythonPath)) { throw "Python environment missing: $pythonPath. Set up this workspace before launching." }
        if (-not (Test-Path -LiteralPath (Join-Path $root '04-output/index.html'))) { throw 'Frontend build missing. Run npm ci and npm run build in the workspace shown above.' }
        $logDir = Join-Path $root 'Codex-Temp'
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
        $errorLog = Join-Path $logDir "preview-$stamp-error.log"
        $process = Start-Process -FilePath $pythonPath -ArgumentList 'tools/run_server.py' -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir "preview-$stamp.log") -RedirectStandardError $errorLog
        $ready = $false
        for ($attempt = 0; $attempt -lt 45; $attempt++) {
            $process.Refresh()
            if ($process.HasExited) { throw "Astra exited during startup. Log: $errorLog" }
            if (Test-AstraReady) { $ready = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ready) { throw "Astra has not become ready yet. Log: $errorLog. Do not repeatedly relaunch." }
        $listener = Get-AstraListener
        if (-not $listener) { throw 'Astra listener disappeared during startup.' }
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if (-not (Test-AstraOwner $owner.CommandLine $pythonPath)) { throw 'Port ownership changed during startup; browser was not opened.' }
    }
    Write-Host 'Ready: http://127.0.0.1:5189/'
    if (-not $NoBrowser -and -not $CheckOnly) { Start-Process 'http://127.0.0.1:5189/' }
}

# Dot sourcing is reserved for isolated launcher tests.
if ($MyInvocation.InvocationName -ne '.') {
    try {
        $mutex = New-Object Threading.Mutex($false, 'Local\ZhisuanAstraPreview5189')
        $locked = $false
        try {
            try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
            if (-not $locked) { throw 'Another Astra launcher is starting. Please wait for it to finish.' }
            Invoke-AstraPreview
        } finally {
            if ($locked) { $mutex.ReleaseMutex() }
            $mutex.Dispose()
        }
        exit 0
    } catch {
        Write-Host "START FAILED: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}
