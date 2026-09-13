param([ValidateRange(15,120)][int]$Seconds=60)
$captureExe=Join-Path $env:LOCALAPPDATA 'ASGARD-Tools/PresentMon-2.5.1/PresentMon.exe'
if(!(Test-Path -LiteralPath $captureExe)){throw 'PresentMon is not installed in the ASGARD tools folder.'}
if(!(Get-Process -Name 'FortniteClient-Win64-Shipping' -ErrorAction SilentlyContinue)){throw 'Start Fortnite and enter your repeatable test scene before recording.'}
$captureDir=Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'ASGARD-Captures'
New-Item -ItemType Directory -Path $captureDir -Force | Out-Null
$capturePath=Join-Path $captureDir ('fortnite-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.csv')
Write-Host 'Recording frame timing only. No keyboard/mouse input tracking. Keep the same test scene.'
& $captureExe --process_name FortniteClient-Win64-Shipping.exe --output_file $capturePath --timed $Seconds --terminate_after_timed --no_track_input --session_name ASGARD-FrameCapture
if($LASTEXITCODE -ne 0){throw 'PresentMon capture failed. If it reports access denied, review the official Performance Log Users setup; no permissions were changed automatically.'}
if(!(Test-Path -LiteralPath $capturePath)){throw 'No CSV was produced.'}
Write-Host ('Saved: '+$capturePath)
Write-Host 'Import it at https://asgrard-backend.rayanfahil2.workers.dev/performance-lab'
