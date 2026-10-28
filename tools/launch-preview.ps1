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
    if ($root -match '[\\/]\.codex[\\/]worktrees[\\/]') {
        throw 'Refusing to host the service in a disposable Codex worktree. Use runtime/astra-service inside the project.'
    }
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

function Test-AstraOwnerProcess([int]$ProcessId, [string]$PythonPath) {
    # Windows venv interpreters redirect to the base Python, so the listener may be a child.
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    for ($depth = 0; $depth -lt 4 -and $process; $depth++) {
        if (Test-AstraOwner ([string]$process.CommandLine) $PythonPath) { return $true }
        if (-not $process.ParentProcessId) { break }
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ParentProcessId)" -ErrorAction SilentlyContinue
    }
    return $false
}

function Get-AstraListener {
    return Get-NetTCPConnection -LocalPort 5189 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Get-AstraSourceHash([string]$Path) {
    # .NET hashing also works when PSModulePath was inherited from PowerShell 7.
    $stream=[IO.File]::OpenRead($Path)
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}

function Test-AstraReady([string]$WorkspaceRoot = '') {
    $script:astraReadyIssue=''; try {
        # Windows PowerShell 5.1 decodes JSON without a charset as Latin-1.
        # Read UTF-8 bytes explicitly so Chinese workspace paths retain identity.
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5189/api/health' -TimeoutSec 2
        $health = ConvertFrom-AstraHealthResponse $response
        if ($health.status -ne 'ok' -or $health.service -ne 'zhisuan-astra' -or $health.isolated -ne $true) { $script:astraReadyIssue='Readiness check 6'; return $false }
        if ($WorkspaceRoot) {
            if (-not $health.workspace -or [IO.Path]::GetFullPath($health.workspace) -ne [IO.Path]::GetFullPath($WorkspaceRoot)) { $script:astraReadyIssue='Readiness check 8'; return $false }
            foreach ($name in @('server.py','weknora.py','weknora_wiki.py','professional_host.py','knowledge_host.py','business_settings.py','row_assist.py','model_adapter.py','gork_notifications.py','gork_config.py','gork_stages.py','vendor/gork-output/external_client.py')) {
                $file = Join-Path $WorkspaceRoot "03-Src/$name"
                if (-not (Test-Path -LiteralPath $file)) { $script:astraReadyIssue='Missing file: '+$file; return $false }
                if ($health.host_sources.$name -ne (Get-AstraSourceHash $file)) { $script:astraReadyIssue='Readiness check 12'; return $false }
            }
            foreach ($capability in @('batch-match-recovery-v1','row-assist-v1','business-settings-v1','gork-stage-notifications-v1','gork-stage-debug-v1')) {
                if ($health.capabilities -notcontains $capability) { $script:astraReadyIssue='Readiness check 15'; return $false }
            }
            $package = Get-Content -LiteralPath (Join-Path $WorkspaceRoot 'package.json') -Raw | ConvertFrom-Json
            if ($health.build.version -ne $package.version) { $script:astraReadyIssue='Readiness check 18'; return $false }
            if (-not $health.build.sources -or -not $health.build.sources.'03-Src/studio/commands.ts') { $script:astraReadyIssue='Readiness check 19'; return $false }
            foreach ($entry in $health.build.sources.PSObject.Properties) {
                $file = Join-Path $WorkspaceRoot $entry.Name
                if (-not (Test-Path -LiteralPath $file)) { $script:astraReadyIssue='Missing file: '+$file; return $false }
                if ($entry.Value -ne (Get-AstraSourceHash $file)) { $script:astraReadyIssue='Frontend source differs: '+$entry.Name; return $false }
            }
        }
        return $true
    } catch { $script:astraReadyIssue=$_.Exception.GetType().Name+': '+$_.Exception.Message; return $false }
}


function ConvertFrom-AstraHealthResponse($Response) {
    if (-not $Response.RawContentStream) { throw 'Health response bytes are missing.' }
    $json = [Text.Encoding]::UTF8.GetString($Response.RawContentStream.ToArray())
    return $json | ConvertFrom-Json
}

function Invoke-AstraPreview {
    $baseRoot = Split-Path $PSScriptRoot -Parent
    $root = Get-AstraLaunchRoot $baseRoot
    $pythonPath = Join-Path $root '.venv/Scripts/python.exe'
    $pythonPath = [IO.Path]::GetFullPath($pythonPath)
    Write-Host "Workspace: $root"
    $listener = Get-AstraListener
    if ($listener) {
        if (-not (Test-AstraOwnerProcess $listener.OwningProcess $pythonPath)) {
            throw 'Port 5189 belongs to a different workspace or service. Nothing was stopped. Check config/astra-launch.local.json.'
        }
        if (-not (Test-AstraReady $root)) { throw ('Astra readiness failed: '+$script:astraReadyIssue+'. No process was restarted.') }
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
        $startupDeadline=[DateTime]::UtcNow.AddSeconds(90)
        while ([DateTime]::UtcNow -lt $startupDeadline) {
            $process.Refresh()
            if ($process.HasExited) { throw "Astra exited during startup. Log: $errorLog" }
            if (Test-AstraReady $root) { $ready = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ready) { throw "Astra has not become ready yet. Reason: $script:astraReadyIssue. Log: $errorLog. Do not repeatedly relaunch." }
        $listener = Get-AstraListener
        if (-not $listener) { throw 'Astra listener disappeared during startup.' }
        if (-not (Test-AstraOwnerProcess $listener.OwningProcess $pythonPath)) { throw 'Port ownership changed during startup; browser was not opened.' }
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
            try { $locked = $mutex.WaitOne(0); if (-not $locked) { Write-Host 'Astra is starting; waiting for the existing launcher.'; $locked = $mutex.WaitOne(100000) } } catch [Threading.AbandonedMutexException] { $locked = $true }
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
