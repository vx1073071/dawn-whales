$b = [System.IO.File]::ReadAllBytes('C:\Users\vx107\.easyclaw\workspace\dawn-whales\package.json')
$l = $b.Length
$first = ($b[0..19] | ForEach-Object { '{0:X2}' -f $_ }) -join '-'
$last = ($b[($l-20)..($l-1)] | ForEach-Object { '{0:X2}' -f $_ }) -join '-'
$out = \"Length=$l`nFirst=$first`nLast=$last\"
[System.IO.File]::WriteAllText('C:\Users\vx107\.easyclaw\workspace\dawn-whales\check-out.txt', $out)