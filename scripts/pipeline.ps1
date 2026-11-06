$ErrorActionPreference = "Stop"
$ImageTag = "citybike:v1"
$GitBash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $GitBash)) { $GitBash = "bash" }

function Run-Gate {
    param([string]$GateName, [string]$EnvName, [string]$ExtraEnv = "", [string]$ScriptPath, [int]$Port = 4174, [string]$TargetUrl = "http://localhost:4174")
    Write-Host "`n=== Running Gate: $GateName ===" -ForegroundColor Yellow
    docker rm -f citybike-gate 2>$null
    if ($ExtraEnv) {
        docker run -d --name citybike-gate -p "$Port`:4173" -e "APP_ENV=$EnvName" -e $ExtraEnv $ImageTag
    } else {
        docker run -d --name citybike-gate -p "$Port`:4173" -e "APP_ENV=$EnvName" $ImageTag
    }
    Write-Host "Polling health at $TargetUrl/health..."
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $res = Invoke-RestMethod -Uri "$TargetUrl/health" -Method Get -ErrorAction Stop
            if ($res.ok -eq $true) { $ready = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) {
        Write-Host "ERROR: Gate $GateName timed out." -ForegroundColor Red
        docker logs citybike-gate; docker rm -f citybike-gate; exit 1
    }
    $env:TARGET_URL = $TargetUrl
    $env:IMAGE_NAME = $ImageTag
    & $GitBash $ScriptPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Gate $GateName failed!" -ForegroundColor Red
        docker logs citybike-gate; docker rm -f citybike-gate; exit $LASTEXITCODE
    }
    Write-Host "SUCCESS: Gate $GateName passed!" -ForegroundColor Green
    docker rm -f citybike-gate
}

Run-Gate -GateName "Staging" -EnvName "staging" -ScriptPath "scripts/test-staging.sh"
Run-Gate -GateName "UAT" -EnvName "uat" -ScriptPath "scripts/test-uat.sh"
Run-Gate -GateName "OAT" -EnvName "oat" -ScriptPath "scripts/test-oat.sh"
Run-Gate -GateName "Preprod" -EnvName "preprod" -ExtraEnv "PROD_API_KEY=lab-secret" -ScriptPath "scripts/test-preprod.sh"

Write-Host "`n=== Running Gate: Prod ===" -ForegroundColor Yellow
docker rm -f citybike-prod 2>$null
docker run -d --name citybike-prod -p 4173:4173 -e "APP_ENV=production" -e "PROD_API_KEY=lab-secret" $ImageTag
Start-Sleep -Seconds 3
$env:TARGET_URL = "http://localhost:4173"
$env:IMAGE_NAME = $ImageTag
& $GitBash scripts/test-prod.sh
if ($LASTEXITCODE -ne 0) { Write-Host "Prod failed!" -ForegroundColor Red; docker logs citybike-prod; exit 1 }
Write-Host "SUCCESS: All 5 gates passed successfully! citybike-prod is live on port 4173." -ForegroundColor Green
