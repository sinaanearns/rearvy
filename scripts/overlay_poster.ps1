param(
    [string]$Base = "website/public/images/rearvy-impact-poster.png",
    [string]$Overlay = "website/public/images/headphone-overlay.png",
    [int]$ScalePercent = 70,
    [int]$DissolvePercent = 75,
    [string]$Out = "website/public/images/rearvy-impact-poster-overlay.png"
)

if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
    Write-Error "ImageMagick 'magick' not found in PATH. Install ImageMagick and ensure 'magick' is available."
    exit 1
}

$resize = "${ScalePercent}%"

# Composite overlay centered with specified scale and opacity (dissolve)
magick `"$Base`" (`"$Overlay`" -resize $resize) -gravity center -dissolve ${DissolvePercent}% -composite `"$Out`"

Write-Host "Wrote $Out"