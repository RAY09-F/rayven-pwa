# Install Asgard locally without changing existing browser extensions or other OBS profiles.
$ErrorActionPreference='Stop'
$target='C:\Asgard\companion'
$py="$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
if (!(Test-Path $py)) { winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements }
if (!(Test-Path 'C:\Program Files\obs-studio\bin\64bit\obs64.exe')) { winget install --id OBSProject.OBSStudio -e --accept-package-agreements --accept-source-agreements }
New-Item -ItemType Directory -Force $target,'C:\Asgard\logs','C:\Asgard\Clips' | Out-Null
Get-CimInstance Win32_Process -Filter "Name='pythonw.exe'" | Where-Object { $_.CommandLine -like '*C:\Asgard\companion\asgard.py*' } | ForEach-Object {Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue}
if ($PSScriptRoot -ne $target) {
    Get-ChildItem -LiteralPath $PSScriptRoot | Where-Object Name -NotIn '.venv','models','audio','secrets.json','config.json','__pycache__','.pytest_cache' | Copy-Item -Destination $target -Recurse -Force
}
if (!(Test-Path "$target\.venv\Scripts\python.exe")) { & $py -m venv "$target\.venv" }
$python="$target\.venv\Scripts\python.exe"
& $python -m pip install --only-binary=:all: -r "$target\requirements.txt"
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
foreach ($model in @(@('vosk-model-small-en-us-0.15',40000000),@('vosk-model-en-us-0.22',1800000000))) {
    $modelDir="$target\models"; New-Item -ItemType Directory -Force $modelDir | Out-Null
    if (!(Test-Path "$modelDir\$($model[0])\am\final.mdl")) {
        $zip="$modelDir\$($model[0]).zip"
        if (!(Test-Path $zip)) { Invoke-WebRequest "https://alphacephei.com/vosk/models/$($model[0]).zip" -OutFile $zip }
        if ((Get-Item $zip).Length -lt $model[1]) { throw 'Model download incomplete' }
        Expand-Archive $zip $modelDir -Force
    }
}
& $python "$target\tools\configure.py"
if ($LASTEXITCODE -ne 0) { throw 'Configuration failed' }
$account=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls "$target\secrets.json" /inheritance:r /grant:r "${account}:(F)" 'SYSTEM:(F)' | Out-Null
$faceSource=Join-Path (Split-Path $PSScriptRoot) 'asgard-face'
& $python "$target\tools\configure-face.py" $faceSource
if ($LASTEXITCODE -ne 0) { throw 'Extension preparation failed' }
icacls 'C:\Asgard\asgard-face\pairing.js' /inheritance:r /grant:r "${account}:(F)" 'SYSTEM:(F)' | Out-Null
$startup=[Environment]::GetFolderPath('Startup');$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut("$startup\Asgard Voice.lnk");$shortcut.TargetPath="$target\.venv\Scripts\pythonw.exe";$shortcut.Arguments='C:\Asgard\companion\asgard.py';$shortcut.WorkingDirectory=$target;$shortcut.WindowStyle=7;$shortcut.Save()
$shortcut=$shell.CreateShortcut("$startup\Asgard Replay.lnk");$shortcut.TargetPath='C:\Program Files\obs-studio\bin\64bit\obs64.exe';$shortcut.Arguments='--profile Asgard --collection Asgard --startreplaybuffer --minimize-to-tray --disable-updater';$shortcut.WorkingDirectory='C:\Program Files\obs-studio\bin\64bit';$shortcut.WindowStyle=7;$shortcut.Save()
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Asgard\companion\watchdog.ps1'
$trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 5)
$principal=New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName AsgardVoiceWatchdog -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
if (!(Get-Process obs64 -ErrorAction SilentlyContinue)) { Start-Process $shortcut.TargetPath -ArgumentList $shortcut.Arguments -WorkingDirectory $shortcut.WorkingDirectory -WindowStyle Hidden }
for ($attempt=0;$attempt -lt 6;$attempt++) {
    Start-Sleep -Seconds 3
    & $python "$target\tools\configure-scene.py"
    if ($LASTEXITCODE -eq 0) { break }
}
if ($LASTEXITCODE -ne 0) { throw 'OBS did not become ready. Read NEXT-STEPS.txt for its crash/startup prompt.' }
& $python "$target\tools\render-voices.py"
& "$target\watchdog.ps1"
& $python -m pytest "$target\tests" -q
if (Test-Path "$target\NEXT-STEPS.txt") { Copy-Item "$target\NEXT-STEPS.txt" ([Environment]::GetFolderPath('Desktop')) -Force }
Set-Clipboard 'C:\Asgard\asgard-face'
Start-Sleep -Seconds 5
& $python "$target\tools\self-test.py"
if ($LASTEXITCODE -ne 0) { Write-Warning 'Not all acceptance criteria passed. See C:\Asgard\logs\acceptance.json and Desktop NEXT-STEPS.txt.' }
