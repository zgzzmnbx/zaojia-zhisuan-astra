$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../tools/launch-preview.ps1"
function Assert($Condition, $Message) { if (-not $Condition) { throw $Message } }
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('astra-launch-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path "$testRoot/tools", "$testRoot/config", "$testRoot/.venv/Scripts", "$testRoot/04-output" -Force | Out-Null
foreach ($file in @('tools/run_server.py','package.json','.venv/Scripts/python.exe','04-output/index.html')) { Set-Content -LiteralPath (Join-Path $testRoot $file) -Value '' }
Assert ((Get-AstraLaunchRoot $testRoot) -eq $testRoot) 'Default workspace resolution failed'
'{"workspace":".."}' | Set-Content -LiteralPath "$testRoot/config/astra-launch.local.json"
$rejected = $false
try { Get-AstraLaunchRoot $testRoot | Out-Null } catch { $rejected = $true }
Assert $rejected 'Invalid workspace was not rejected'
$python = [IO.Path]::GetFullPath((Join-Path $testRoot '.venv/Scripts/python.exe'))
Assert (Test-AstraOwner ('"' + $python + '" tools/run_server.py') $python) 'Expected interpreter rejected'
Assert (-not (Test-AstraOwner 'python other-app.py' $python)) 'Foreign process accepted'

# A healthy HTTP response is insufficient: require loaded identity and source/build parity.
New-Item -ItemType Directory -Path "$testRoot/03-Src/studio", "$testRoot/03-Src/vendor/gork-output" -Force | Out-Null
'{"version":"0.9.21"}' | Set-Content -LiteralPath "$testRoot/package.json"
$sources=@{}
foreach ($name in @('server.py','weknora.py','weknora_wiki.py','professional_host.py','knowledge_host.py','business_settings.py','row_assist.py','model_adapter.py','gork_notifications.py','gork_config.py','gork_stages.py','vendor/gork-output/external_client.py')) {
    Set-Content -LiteralPath "$testRoot/03-Src/$name" -Value 'fixture'
    $sources[$name]=(Get-FileHash -LiteralPath "$testRoot/03-Src/$name").Hash.ToLowerInvariant()
}
Set-Content -LiteralPath "$testRoot/03-Src/studio/commands.ts" -Value 'fixture'
$script:health=[pscustomobject]@{status='ok';service='zhisuan-astra';isolated=$true;workspace=$testRoot;host_sources=$sources;capabilities=@('batch-match-recovery-v1','row-assist-v1','business-settings-v1','gork-stage-notifications-v1','gork-stage-debug-v1');build=@{version='0.9.21';sources=@{'03-Src/studio/commands.ts'=(Get-FileHash -LiteralPath "$testRoot/03-Src/studio/commands.ts").Hash.ToLowerInvariant()}}}
$script:health=$script:health | ConvertTo-Json -Depth 8 | ConvertFrom-Json
function Invoke-WebRequest {
    $bytes=[Text.Encoding]::UTF8.GetBytes(($script:health | ConvertTo-Json -Depth 8))
    return @{RawContentStream=[IO.MemoryStream]::new($bytes)}
}
# Reproduce Windows PowerShell's missing Get-FileHash module without weakening source verification.
function Get-FileHash { throw 'Hash cmdlet deliberately unavailable in launcher acceptance' }
# UTF-8 identity survives Windows PowerShell's missing-charset response behavior.
$unicodeName='fixture-' + [char]0x667A + [char]0x7B97
$unicodeBytes=[Text.Encoding]::UTF8.GetBytes(('{"workspace":"'+$unicodeName+'"}'))
$decoded=ConvertFrom-AstraHealthResponse @{RawContentStream=[IO.MemoryStream]::new($unicodeBytes)}
Assert ($decoded.workspace -eq $unicodeName) 'UTF-8 health workspace was corrupted'
Assert (Test-AstraReady $testRoot) 'Current loaded source and build identity rejected'
Set-Content -LiteralPath "$testRoot/03-Src/studio/commands.ts" -Value 'new frontend source'
Assert (-not (Test-AstraReady $testRoot)) 'Stale frontend accepted despite HTTP 200'
Set-Content -LiteralPath "$testRoot/03-Src/studio/commands.ts" -Value 'fixture'
Set-Content -LiteralPath "$testRoot/03-Src/row_assist.py" -Value 'new host source'
Assert (-not (Test-AstraReady $testRoot)) 'Stale host accepted despite HTTP 200'
Set-Content -LiteralPath "$testRoot/03-Src/row_assist.py" -Value 'fixture'
$script:health.workspace='C:/other-workspace'
Assert (-not (Test-AstraReady $testRoot)) 'Foreign runtime directory accepted'
$script:health.workspace=$testRoot
$script:health.capabilities=@()
Assert (-not (Test-AstraReady $testRoot)) 'Missing capability accepted'

# Replace process and network boundaries; never start/stop a real service in these tests.
function Get-AstraLaunchRoot { return $testRoot }
function Get-AstraListener { if ($script:running) { return @{OwningProcess=123} } }
function Get-CimInstance { return @{CommandLine=$script:command} }
function Test-AstraReady { return $script:ready }
function Start-Sleep {}
function Start-Process {
    param($FilePath,$ArgumentList,$WorkingDirectory,[switch]$PassThru,$WindowStyle,$RedirectStandardOutput,$RedirectStandardError)
    if ($FilePath -like 'http*') { $script:opened++; return }
    Assert ($WindowStyle -eq 'Hidden') 'Background service must be hidden'
    $script:started++; $script:running=$true
    $result=[pscustomobject]@{HasExited=$false}
    $result | Add-Member -MemberType ScriptMethod -Name Refresh -Value {}
    return $result
}
$script:started=0; $script:opened=0; $script:running=$true; $script:ready=$true
$script:command='"' + $python + '" tools/run_server.py'
$NoBrowser=$false; $CheckOnly=$false
Invoke-AstraPreview
Assert ($started -eq 0 -and $opened -eq 1) 'Running service should only open browser'
$script:command='python other-app.py'
$rejected=$false; try { Invoke-AstraPreview } catch { $rejected=$true }
Assert ($rejected -and $started -eq 0 -and $opened -eq 1) 'Conflict was not isolated'
$script:command='"' + $python + '" tools/run_server.py'; $script:ready=$false
$rejected=$false; try { Invoke-AstraPreview } catch { $rejected=$true }
Assert ($rejected -and $started -eq 0) 'Unhealthy service should not be restarted'
$script:running=$false; $CheckOnly=$true
$rejected=$false; try { Invoke-AstraPreview } catch { $rejected=$true }
Assert ($rejected -and $started -eq 0) 'Read-only check started a process'
$CheckOnly=$false; $script:ready=$true
Invoke-AstraPreview
Assert ($started -eq 1 -and $opened -eq 2) 'Cold start should open browser only after readiness'
Write-Host 'PASS: workspace resolution, config validation, owner identity, reuse, conflict, unhealthy service, check-only, cold-start readiness.'
