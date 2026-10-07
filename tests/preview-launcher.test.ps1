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
