$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$out=Join-Path $repo 'dist'
New-Item -ItemType Directory -Force $out | Out-Null
# Use forward slashes inside the ZIP for Foundry servers hosted on Linux.
Add-Type -AssemblyName System.IO.Compression
$zipPath=Join-Path $out 'quedaco-npcs-de-venda.zip'
$stream=[System.IO.File]::Open($zipPath,[System.IO.FileMode]::Create)
try {
  $archive=New-Object System.IO.Compression.ZipArchive($stream,[System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $files=@(Get-Item -LiteralPath (Join-Path $repo 'module.json'),(Join-Path $repo 'README.md'))
    $files+=@(Get-ChildItem -LiteralPath (Join-Path $repo 'src'),(Join-Path $repo 'styles') -Recurse -File)
    foreach($file in $files){
      $relative=$file.FullName.Substring($repo.Length+1).Replace('\','/')
      $entry=$archive.CreateEntry($relative,[System.IO.Compression.CompressionLevel]::Optimal)
      $target=$entry.Open()
      try{$bytes=[System.IO.File]::ReadAllBytes($file.FullName);$target.Write($bytes,0,$bytes.Length)}finally{$target.Dispose()}
    }
  } finally {$archive.Dispose()}
} finally {$stream.Dispose()}
Copy-Item -LiteralPath (Join-Path $repo 'module.json') -Destination (Join-Path $out 'module.json')
