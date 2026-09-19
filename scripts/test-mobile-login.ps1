# Simulates mobile app auth + dashboard (same API as Flutter)
$base = 'http://localhost:5000/api/v1'

Write-Host "`n=== NDFA Mobile Login Test ===" -ForegroundColor Cyan

$body = @{
  mobile   = '9000000003'
  password = 'ndfa1234'
  role     = 'fieldOfficer'
} | ConvertTo-Json

try {
  $login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body $body -ContentType 'application/json'
  Write-Host "[OK] Password login: $($login.data.name) @ $($login.data.branch)" -ForegroundColor Green
  $token = $login.data.token
} catch {
  Write-Host "[FAIL] Login: $_" -ForegroundColor Red
  exit 1
}

$otpBody = @{ mobile = '9000000003'; otp = '123456'; role = 'fieldOfficer' } | ConvertTo-Json
try {
  $otp = Invoke-RestMethod -Uri "$base/auth/otp/verify" -Method Post -Body $otpBody -ContentType 'application/json'
  Write-Host "[OK] OTP login: $($otp.data.name)" -ForegroundColor Green
} catch {
  Write-Host "[FAIL] OTP: $_" -ForegroundColor Red
}

$h = @{ Authorization = "Bearer $token" }
$dash = Invoke-RestMethod -Uri "$base/dashboard/stats" -Headers $h
Write-Host "[OK] Dashboard: branch=$($dash.data.branch) listings pending=$($dash.data.pendingCustomerListing)" -ForegroundColor Green

Write-Host "`nUse on phone: api_constants.dart -> deviceHost = YOUR_PC_IP, useEmulatorHost = false" -ForegroundColor Yellow
Write-Host "Credentials: 9000000003 / ndfa1234 / Field Officer (OTP 123456)`n" -ForegroundColor Yellow
