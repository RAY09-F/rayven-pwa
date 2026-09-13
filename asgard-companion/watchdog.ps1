# Restart only this companion if its process is absent; retain interactive tray access.
$ErrorActionPreference='Stop'
$root='C:\Asgard\companion'
$match=Get-CimInstance Win32_Process -Filter "Name='pythonw.exe'" | Where-Object { $_.CommandLine -like '*C:\Asgard\companion\asgard.py*' }
if(-not $match){Start-Process -FilePath "$root\.venv\Scripts\pythonw.exe" -ArgumentList 'C:\Asgard\companion\asgard.py' -WorkingDirectory $root -WindowStyle Hidden}
