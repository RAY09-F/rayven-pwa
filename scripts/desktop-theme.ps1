param([ValidateSet('thor','loki','odin','restore')][string]$Mode='thor')
$taskDir=Join-Path $env:LOCALAPPDATA 'ASGARD-RGB'
$backup=Join-Path $taskDir 'desktop-original.json'
$reg=Get-ItemProperty -LiteralPath 'HKCU:\Control Panel\Desktop'
$dwm=Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\DWM'
if(!(Test-Path -LiteralPath $backup)){@{Wallpaper=$reg.WallPaper;AccentColor=$dwm.AccentColor;ColorPrevalence=$dwm.ColorPrevalence}|ConvertTo-Json|Set-Content -LiteralPath $backup}
if($Mode -eq 'restore'){$original=Get-Content -LiteralPath $backup -Raw|ConvertFrom-Json;$wallpaper=$original.Wallpaper;$accent=$original.AccentColor;$prevalence=$original.ColorPrevalence}
else{$wallpaper=Join-Path $taskDir ('crown-'+$Mode+'.png');if(!(Test-Path -LiteralPath $wallpaper)){throw 'Wallpaper missing'};$accent=@{thor=[Convert]::ToUInt32('FFFFB347',16);loki=[Convert]::ToUInt32('FF52B31F',16);odin=[Convert]::ToUInt32('FF40A3DB',16)}[$Mode];$prevalence=1}
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class AsgardDesktop { [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool SystemParametersInfo(int a,int b,string c,int d); }'
if(![AsgardDesktop]::SystemParametersInfo(20,0,$wallpaper,3)){throw 'Windows rejected wallpaper update'}
if($null -ne $accent){Set-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\DWM' -Name AccentColor -Value $accent}
if($null -ne $prevalence){Set-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\DWM' -Name ColorPrevalence -Value $prevalence}

