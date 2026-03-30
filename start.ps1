$dir = "C:\Users\12130\WorkBuddy\20260327083651"
Set-Location $dir
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$proc = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $dir -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 4
if ($proc.HasExited) {
    Write-Host "FAILED ExitCode: $($proc.ExitCode)"
} else {
    Write-Host "RUNNING PID: $($proc.Id)"
}
