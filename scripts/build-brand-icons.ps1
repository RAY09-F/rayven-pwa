$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$brandRoot = Join-Path $PSScriptRoot '../public/brand'
$brandSource = [System.Drawing.Image]::FromFile((Join-Path $brandRoot 'asgard-crown-master.png'))
try {
  foreach ($size in @(16,32,48,64,180,192,256,512)) {
    $bitmap = New-Object System.Drawing.Bitmap($size,$size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($brandSource,0,0,$size,$size)
    $bitmap.Save((Join-Path $brandRoot "asgard-crown-$size.png"),[System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
  }
  # Extra inset keeps the complete emblem inside circular and rounded OS masks.
  $bitmap = New-Object System.Drawing.Bitmap(512,512)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Black)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($brandSource,77,77,358,358)
  $bitmap.Save((Join-Path $brandRoot 'asgard-crown-maskable-512.png'),[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
  $sizes = @(16,32,48,64,256)
  $stream = [System.IO.File]::Create((Join-Path $brandRoot 'asgard-crown.ico'))
  $writer = New-Object System.IO.BinaryWriter($stream)
  try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    foreach ($size in $sizes) {
      $bytes = [System.IO.File]::ReadAllBytes((Join-Path $brandRoot "asgard-crown-$size.png"))
      $dimension = if ($size -eq 256) { 0 } else { $size }
      $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
      $writer.Write([byte]0); $writer.Write([byte]0)
      $writer.Write([uint16]1); $writer.Write([uint16]32)
      $writer.Write([uint32]$bytes.Length); $writer.Write([uint32]$offset)
      $offset += $bytes.Length
    }
    foreach ($size in $sizes) { $writer.Write([System.IO.File]::ReadAllBytes((Join-Path $brandRoot "asgard-crown-$size.png"))) }
  } finally { $writer.Dispose(); $stream.Dispose() }
} finally { $brandSource.Dispose() }
