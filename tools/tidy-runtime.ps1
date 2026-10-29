param([switch]$Apply)
$ErrorActionPreference='Stop'
function Get-RuntimeArchiveHash([string]$Path) {
    $stream=[IO.File]::OpenRead($Path)
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}
# Packaging maintenance v1.0.0. Preview by default; never delete files.
$project=(Resolve-Path -LiteralPath (Split-Path $PSScriptRoot -Parent)).Path
$service=[IO.Path]::GetFullPath((Join-Path $project 'runtime/astra-service'))
$config=Get-Content -LiteralPath (Join-Path $project 'config/astra-launch.local.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ([IO.Path]::GetFullPath([string]$config.workspace) -ne $service) { throw 'Launcher is not using the expected project runtime.' }
if ((Get-Item -LiteralPath $service).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Runtime must not be a junction or symlink.' }
$build=Get-Content -LiteralPath (Join-Path $service '04-output/astra-build.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$candidates=@('README.md','AGENTS.md','CHANGELOG.md','DESIGN.md','FRONTEND_DEBUG.md','00-docs','tests','package-lock.json','requirements.txt','requirements.lock.txt','tsconfig.json','vite.frontend-debug.config.js')
$candidates+=@(Get-ChildItem -LiteralPath $service -File -Force | Where-Object { $_.Name -like 'CHANGELOG-*.md' -or $_.Extension -eq '.bat' } | ForEach-Object Name)
$candidates=@($candidates | Select-Object -Unique | Where-Object { Test-Path -LiteralPath (Join-Path $service $_) })
$protected=@('.venv','03-Src','04-output','config','public','runtime','Codex-Temp','tools','package.json','THIRD_PARTY_NOTICES.md','SERVICE-README.md')
foreach ($name in $candidates) {
    if ($protected -contains $name -or [IO.Path]::GetFileName($name) -ne $name) { throw "Forbidden runtime item: $name" }
    foreach ($entry in $build.sources.PSObject.Properties) {
        if ($entry.Name -eq $name -or $entry.Name.StartsWith($name+'/',[StringComparison]::OrdinalIgnoreCase)) { throw "Build requires runtime item: $name" }
    }
    $item=Get-Item -LiteralPath (Join-Path $service $name) -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing linked item: $name" }
    $linked=Get-ChildItem -LiteralPath $item.FullName -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }
    if ($linked) { throw "Refusing linked descendants: $name" }
}
if (-not $Apply -or $candidates.Count -eq 0) {
    [pscustomobject]@{version='1.0.0';apply=$false;runtime=$service;items=$candidates} | ConvertTo-Json -Depth 4
    exit 0
}
$backups=[IO.Path]::GetFullPath((Join-Path $project 'runtime/backups'))
$archive=[IO.Path]::GetFullPath((Join-Path $backups ('runtime-development-files-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))))
if (-not $archive.StartsWith($backups+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Archive escaped backup directory.' }
$records=@()
foreach ($name in $candidates) {
    $item=Get-Item -LiteralPath (Join-Path $service $name) -Force
    $files=if ($item.PSIsContainer) { @(Get-ChildItem -LiteralPath $item.FullName -File -Recurse -Force) } else { @($item) }
    foreach ($file in $files) {
        $relative=$file.FullName.Substring($service.Length+1)
        $records+=[pscustomobject]@{path=$relative;sha256=(Get-RuntimeArchiveHash $file.FullName);bytes=$file.Length}
    }
}
New-Item -ItemType Directory -Path $archive | Out-Null
$manifest=Join-Path $archive 'manifest.json'
[pscustomobject]@{version='1.0.0';runtime=$service;items=$candidates;files=$records} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifest -Encoding UTF8
foreach ($name in $candidates) {
    $source=[IO.Path]::GetFullPath((Join-Path $service $name))
    $destination=[IO.Path]::GetFullPath((Join-Path $archive $name))
    if (-not $source.StartsWith($service+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or
        -not $destination.StartsWith($archive+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Move escaped verified directories.' }
    Move-Item -LiteralPath $source -Destination $destination
}
foreach ($record in $records) {
    if ((Get-RuntimeArchiveHash (Join-Path $archive $record.path)) -ne $record.sha256) { throw "Archive checksum differs: $($record.path)" }
}
[pscustomobject]@{version='1.0.0';apply=$true;archive=$archive;items=$candidates;verified_files=$records.Count} | ConvertTo-Json -Depth 4
