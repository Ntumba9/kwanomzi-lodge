# Phase 2 - Step 1 (Windows/PowerShell): Generate the private CA, the EC2
# proxy's server cert, and the Vercel client cert, entirely on your local PC.
#
# ca.key never leaves this machine unless you explicitly copy it somewhere
# yourself. This script does not print, upload, or transmit any key.
#
# Requires openssl.exe on PATH. Git for Windows ships one:
#   (Get-Command git).Source -> ...\Git\cmd\git.exe
#   openssl is usually at ...\Git\usr\bin\openssl.exe
# If `openssl version` fails below, install Git for Windows or run:
#   winget install ShiningLight.OpenSSL.Light
#
# Run from anywhere; output goes to .\certs\ next to this script
# (already gitignored via /infra/mtls-relay/certs/ in .gitignore).

$ErrorActionPreference = "Stop"

$opensslCmd = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $opensslCmd) {
    Write-Error "openssl not found on PATH. Install Git for Windows (includes openssl) or 'winget install ShiningLight.OpenSSL.Light', then re-run."
    exit 1
}

$ProxyIP  = "13.63.60.102"
$OutDir   = Join-Path $PSScriptRoot "certs"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$DaysCA   = 3650
$DaysLeaf = 825

Push-Location $OutDir
try {
    Write-Host "== 1. Private CA ==" -ForegroundColor Cyan
    if (Test-Path "ca.key") {
        Write-Host "ca.key already exists - reusing existing CA (delete .\certs manually to regenerate)"
    } else {
        & openssl genrsa -out ca.key 4096
        & openssl req -x509 -new -nodes -key ca.key -sha256 -days $DaysCA `
            -subj "/C=ZA/O=KwaNomzi Lodge/CN=KwaNomzi DB Relay CA" `
            -out ca.crt
    }

    Write-Host "== 2. EC2 proxy server certificate (CN/SAN = $ProxyIP) ==" -ForegroundColor Cyan
    & openssl genrsa -out server.key 2048
    & openssl req -new -key server.key `
        -subj "/C=ZA/O=KwaNomzi Lodge/CN=$ProxyIP" `
        -out server.csr

    $serverExt = "subjectAltName = IP:$ProxyIP`nextendedKeyUsage = serverAuth`n"
    [System.IO.File]::WriteAllText((Join-Path $OutDir "server.ext"), $serverExt, [System.Text.Encoding]::ASCII)

    & openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial `
        -out server.crt -days $DaysLeaf -sha256 -extfile server.ext

    Write-Host "== 3. Vercel client certificate ==" -ForegroundColor Cyan
    & openssl genrsa -out client.key 2048
    & openssl req -new -key client.key `
        -subj "/C=ZA/O=KwaNomzi Lodge/CN=vercel-app-client" `
        -out client.csr

    $clientExt = "extendedKeyUsage = clientAuth`n"
    [System.IO.File]::WriteAllText((Join-Path $OutDir "client.ext"), $clientExt, [System.Text.Encoding]::ASCII)

    & openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial `
        -out client.crt -days $DaysLeaf -sha256 -extfile client.ext

    Remove-Item -ErrorAction SilentlyContinue server.csr, client.csr, server.ext, client.ext

    Write-Host ""
    Write-Host "Done. Files in $OutDir :" -ForegroundColor Green
    Get-ChildItem $OutDir | Format-Table Name, Length, LastWriteTime

    Write-Host ""
    Write-Host "Next:" -ForegroundColor Yellow
    Write-Host "  - Copy ca.crt, server.crt, server.key to the EC2 proxy (see 02-install-stunnel.sh)."
    Write-Host "  - Keep ca.key on THIS PC ONLY. Never copy it to EC2, never commit it, never paste it anywhere."
    Write-Host "  - client.crt/client.key/ca.crt are for Phase 3 (Vercel) - do not wire them up yet."
}
finally {
    Pop-Location
}
