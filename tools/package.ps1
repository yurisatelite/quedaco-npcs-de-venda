$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$out=Join-Path $repo 'dist'
New-Item -ItemType Directory -Force $out | Out-Null
Compress-Archive -Path (Join-Path $repo 'module.json'),(Join-Path $repo 'src'),(Join-Path $repo 'styles'),(Join-Path $repo 'README.md') -DestinationPath (Join-Path $out 'quedaco-npcs-de-venda.zip') -Force
Copy-Item -LiteralPath (Join-Path $repo 'module.json') -Destination (Join-Path $out 'module.json')
