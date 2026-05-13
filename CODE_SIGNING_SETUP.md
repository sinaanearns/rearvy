# Code Signing Setup for Rearvy Desktop App

This guide explains how to set up code signing for Windows to eliminate the "Unknown publisher" warning from Windows Defender SmartScreen.

## Quick Summary for Your Users

**Free options that work:**
1. **One-time SmartScreen click** — Users click "Run anyway" once, app works forever (easiest)
2. **Windows Defender exclusion** — Run `setup-windows-defender.bat` (zero warnings forever)
3. **Both combined** — Self-signed cert + exclusion = best experience

👉 **See [USER_SETUP_GUIDE.md](USER_SETUP_GUIDE.md)** for user instructions

## Overview

- **Development**: Use a self-signed certificate (no cost, works locally)
- **Production**: Use a self-signed certificate OR let users opt-in to Windows Defender exclusion

## Option 1: Development/Testing (Self-Signed Certificate)

### Step 1: Create a Self-Signed Certificate

Run this PowerShell command (as Administrator):

```powershell
# Create a self-signed certificate
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Rearvy Dev" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -NotBefore (Get-Date) `
  -NotAfter (Get-Date).AddYears(1) `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -HashAlgorithm SHA256

# Export to .pfx file (with password)
$password = ConvertTo-SecureString -String "YOUR_PASSWORD_HERE" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "$env:USERPROFILE\rearvy-dev-cert.pfx" -Password $password

Write-Host "Certificate saved to: $env:USERPROFILE\rearvy-dev-cert.pfx"
```

**Replace `YOUR_PASSWORD_HERE`** with a strong password and **remember it!**

### Step 2: Configure Environment Variables

Add these to your `.env.local` (in repo root):

```env
WIN_CSC_KEY_PASSWORD=YOUR_PASSWORD_HERE
WIN_CSC_LINK=file://path/to/rearvy-dev-cert.pfx
```

**On Windows, use forward slashes:** `file://C:/Users/sinaa/rearvy-dev-cert.pfx`

### Step 3: Update Build Config

Update [desktop-app/package.json](desktop-app/package.json) `build.win` section:

```json
"win": {
  "icon": "../public/rearvy.ico",
  "signAndEditExecutable": true,
  "signingHashAlgorithms": ["sha256"],
  "certificateFile": "./rearvy-dev-cert.pfx",
  "certificatePassword": "${env:WIN_CSC_KEY_PASSWORD}",
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ]
}
```

### Step 4: Build & Test

```bash
npm run build:win
```

---

## Option 2: Production (Commercial Certificate)

For public releases, you need a **commercial code signing certificate**. Options:

### Recommended Providers:
- **DigiCert** (~$200-400/year) — Industry standard
- **Sectigo** (~$100-200/year) — Budget-friendly
- **GlobalSign** (~$300-500/year) — High reputation

### Getting a Certificate:
1. Purchase from provider above
2. Generate a CSR (Certificate Signing Request) via their portal
3. Verify domain ownership
4. Download `.pfx` file
5. Store password securely

### Configure for GitHub Actions (CI/CD):

#### Setup in GitHub:

1. **Add secret to GitHub repo:**
   - Go to **Settings > Secrets and variables > Actions**
   - Add `WIN_CSC_LINK` — Base64-encoded .pfx file:
     ```powershell
     $cert = [System.IO.File]::ReadAllBytes("C:\path\to\cert.pfx")
     [System.Convert]::ToBase64String($cert) | Set-Clipboard
     ```
   - Add `WIN_CSC_KEY_PASSWORD` — Certificate password

2. **Update GitHub Actions workflow** (`.github/workflows/build.yml`):
   ```yaml
   jobs:
     build-windows:
       runs-on: windows-latest
       env:
         WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
         WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
       steps:
         - uses: actions/checkout@v3
         - run: npm run build:win
   ```

---

## Update Build Configuration

### desktop-app/package.json - win section:

```json
"win": {
  "icon": "../public/rearvy.ico",
  "signAndEditExecutable": true,
  "signingHashAlgorithms": ["sha256"],
  "certificateFile": "${WIN_CSC_LINK}",
  "certificatePassword": "${env:WIN_CSC_KEY_PASSWORD}",
  "signingCertificateChain": "build/certificateChain.p7b",
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ]
}
```

---

## Verification

After building with signing enabled:

```powershell
# Check if exe is signed
Get-AuthenticodeSignature "desktop-release/Rearvy-0.1.1-win-x64.exe"

# Should output:
# Status        : Valid
# SignerCertificate : [Your certificate]
```

---

## Immediate Fix (Without Signing)

If you need the app working **right now** while setting up signing:

### Option A: Windows Defender Exclusion
1. Open **Windows Security**
2. **Virus & threat protection > Manage settings**
3. **Exclusions > Add exclusions**
4. Add: `C:\Users\sinaa\rearvy2.0\desktop-release`

### Option B: Mark as Trusted
1. Right-click `Rearvy-win-x64.exe`
2. **Properties > Digital Signatures**
3. Accept the unsigned certificate

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Certificate not found" | Verify path in `WIN_CSC_LINK` uses forward slashes |
| "Invalid password" | Check `WIN_CSC_KEY_PASSWORD` matches certificate |
| Build still shows "Unknown" | Ensure `signAndEditExecutable: true` and rebuild |
| Certificate expired | Renew certificate and update .pfx file |

---

## Environment Variables Reference

| Variable | Value | Example |
|----------|-------|---------|
| `WIN_CSC_LINK` | Path to .pfx file | `file://C:/Users/sinaa/rearvy-dev-cert.pfx` |
| `WIN_CSC_KEY_PASSWORD` | Certificate password | `your-strong-password` |

---

## Next Steps

1. **Development**: Follow Option 1 (self-signed) to test locally
2. **Testing**: Build with `npm run build:win` and verify no SmartScreen warning
3. **Production**: Get commercial certificate and follow Option 2
4. **CI/CD**: Add GitHub secrets and update workflows

For questions, see [electron-builder signing docs](https://www.electron.build/code-signing)
