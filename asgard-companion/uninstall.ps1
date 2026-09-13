# Remove only registered voice-companion integration; retain user recordings and recoverable files.
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath('C:\Asgard\companion')
if($root -ne 'C:\Asgard\companion'){throw 'Unexpected uninstall path'}
Get-CimInstance Win32_Process -Filter "Name='pythonw.exe'" | Where-Object { $_.CommandLine -like '*C:\Asgard\companion\asgard.py*' } | ForEach-Object {Stop-Process -Id $_.ProcessId}
Unregister-ScheduledTask -TaskName 'AsgardVoiceWatchdog' -Confirm:$false -ErrorAction SilentlyContinue
$startup=[Environment]::GetFolderPath('Startup')
foreach($name in @('Asgard Voice.lnk','Asgard Replay.lnk')){if(Test-Path "$startup\$name"){Remove-Item -LiteralPath "$startup\$name"}}
Write-Host 'Asgard voice startup disabled. Companion files, OBS profiles, and clips retained for recovery.'
