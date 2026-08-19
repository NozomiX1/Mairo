param([string]$Query, [string]$OutFile)
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$base = 'file:///C:/Users/fengxi01/Desktop/mario/mario-glm5-3/index.html'
$url = "$($base)?$Query"
$tmp = Join-Path $env:TEMP "dsh_dump_$([guid]::NewGuid().ToString('N').Substring(0,8)).html"
& $edge --headless --disable-gpu --virtual-time-budget=5000 --dump-dom $url 2>$null | Out-File -Encoding utf8 $tmp
$dom = Get-Content $tmp -Raw
if ($dom -match '(?s)<pre id="qa-dump"[^>]*>(.*?)</pre>') {
  $content = $Matches[1] -replace '&lt;','<' -replace '&gt;','>' -replace '&amp;','&' -replace '&#39;',"'"
  [System.IO.File]::WriteAllText($OutFile, $content)
  Write-Output "OK -> $OutFile ($($content.Length) chars)"
} else {
  Write-Output "NO DUMP FOUND. DOM length: $($dom.Length)"
  $dom | Select-Object -First 1 | ForEach-Object { $_.Substring(0, [Math]::Min(500, $_.Length)) }
}
Remove-Item $tmp -ErrorAction SilentlyContinue
