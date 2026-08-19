param([string]$Query, [string]$OutFile)
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$base = 'file:///C:/Users/fengxi01/Desktop/mario/mario-glm5-3/index.html'
$url = "$($base)?$Query"
$tmp = Join-Path $env:TEMP "dsh_png_$([guid]::NewGuid().ToString('N').Substring(0,8)).html"
& $edge --headless --disable-gpu --virtual-time-budget=5000 --dump-dom $url 2>$null | Out-File -Encoding utf8 $tmp
$dom = Get-Content $tmp -Raw
if ($dom -match 'id="qa-png"\s+href="data:image/png;base64,([A-Za-z0-9+/=]+)"') {
  [System.IO.File]::WriteAllBytes($OutFile, [System.Convert]::FromBase64String($Matches[1]))
  Write-Output "PNG OK -> $OutFile ($((Get-Item $OutFile).Length) bytes)"
} elseif ($dom -match 'PNGERROR:([^<]*)') {
  Write-Output "PNG ERROR: $($Matches[1])"
} else {
  Write-Output "NO PNG FOUND (dom=$($dom.Length))"
}
Remove-Item $tmp -ErrorAction SilentlyContinue
