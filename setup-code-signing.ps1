# Automated Code Signing Setup for Rearvy
param([string]$Password = "rearvy2024")

$admin = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Please run as Administrator!"
    exit 1
}

$certPath = "$env:USERPROFILE\rearvy-dev-cert.pfx"

if (Test-Path $certPath) {
    Write-Host "Certificate already exists at: $certPath"
} else {
    Write-Host "Creating self-signed certificate..."
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Rearvy" -KeyAlgorithm RSA -KeyLength 2048 -NotAfter (Get-Date).AddYears(1) -CertStoreLocation "Cert:\CurrentUser\My" -HashAlgorithm SHA256
    $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $securePassword | Out-Null
    Write-Host "Certificate created at: $certPath"
}

$envPath = ".\.env.local"
$certPathFormatted = $certPath.Replace('\', '/')
$envContent = "WIN_CSC_LINK=file://$certPathFormatted`nWIN_CSC_KEY_PASSWORD=$Password"

if (Test-Path $envPath) {
    $existing = Get-Content $envPath -Raw
    if ($existing -notmatch "WIN_CSC_LINK") {
        Add-Content $envPath "`n$envContent"
        Write-Host "Updated .env.local"
    } else {
        Write-Host ".env.local already configured"
    }
} else {
    Set-Content $envPath $envContent
    Write-Host "Created .env.local"
}

Write-Host ""
Write-Host "Setup complete!"
Write-Host "Next: Run npm run build:win"
