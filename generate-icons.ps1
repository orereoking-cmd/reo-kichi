Add-Type -AssemblyName System.Drawing

function New-Icon {
  param(
    [int]$Size,
    [string]$OutPath
  )

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

  $bg = [System.Drawing.ColorTranslator]::FromHtml("#0a0e16")
  $g.Clear($bg)

  $gold = [System.Drawing.ColorTranslator]::FromHtml("#d4af37")
  $goldBrush = New-Object System.Drawing.SolidBrush($gold)

  $fontSize = $Size * 0.44
  $font = New-Object System.Drawing.Font("Yu Gothic", $fontSize, [System.Drawing.FontStyle]::Bold)
  $text = [char]0x57FA
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $yOffset = $Size * 0.05
  $rect = New-Object System.Drawing.RectangleF(0, $yOffset, $Size, $Size)
  $g.DrawString($text, $font, $goldBrush, $rect, $format)

  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Output "Saved $OutPath"
}

New-Icon -Size 512 -OutPath "$PSScriptRoot\icon-512.png"
New-Icon -Size 192 -OutPath "$PSScriptRoot\icon-192.png"
New-Icon -Size 180 -OutPath "$PSScriptRoot\icon-180.png"
