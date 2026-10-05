$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 18 or newer, then run this script again.'
}

Push-Location -LiteralPath $PSScriptRoot
try {
    & node .\server.mjs
    $serverExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $serverExitCode
