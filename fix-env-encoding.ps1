# Fix .env.local encoding and Firebase configuration
Write-Host "Checking .env.local file..." -ForegroundColor Yellow

if (Test-Path ".env.local") {
    Write-Host "Found .env.local file" -ForegroundColor Green
    
    # Check current encoding
    $content = Get-Content ".env.local" -Raw
    Write-Host "Current file size: $($content.Length) characters" -ForegroundColor Cyan
    
    # Check for Firebase service account key
    if ($content -match "FIREBASE_SERVICE_ACCOUNT_KEY") {
        Write-Host "✓ FIREBASE_SERVICE_ACCOUNT_KEY found in .env.local" -ForegroundColor Green
        
        # Check if it's a valid JSON
        $keyMatch = [regex]::Match($content, 'FIREBASE_SERVICE_ACCOUNT_KEY=(.+)')
        if ($keyMatch.Success) {
            $keyValue = $keyMatch.Groups[1].Value.Trim()
            try {
                $keyValue | ConvertFrom-Json | Out-Null
                Write-Host "✓ Firebase service account key is valid JSON" -ForegroundColor Green
            } catch {
                Write-Host "✗ Firebase service account key is invalid JSON: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "✗ FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local" -ForegroundColor Red
        Write-Host "This is required for Firebase Admin SDK to work" -ForegroundColor Yellow
    }
    
    # Re-save with proper UTF-8 encoding (no BOM)
    Write-Host "Re-saving .env.local with UTF-8 encoding (no BOM)..." -ForegroundColor Yellow
    $utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText((Join-Path $PWD ".env.local"), $content, $utf8NoBomEncoding)
    Write-Host "✓ File re-saved with proper encoding" -ForegroundColor Green
    
} else {
    Write-Host "✗ .env.local file not found" -ForegroundColor Red
    Write-Host "You need to create .env.local with Firebase configuration" -ForegroundColor Yellow
}

# Check if server is running
Write-Host "`nChecking if development server is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/admin/firebase-debug" -UseBasicParsing -TimeoutSec 5
    $diagnostics = $response.Content | ConvertFrom-Json
    
    Write-Host "✓ Server is running" -ForegroundColor Green
    Write-Host "Firebase Admin SDK Status:" -ForegroundColor Cyan
    Write-Host "  - Available: $($diagnostics.diagnostics.adminSdkStatus.isAvailable)" -ForegroundColor $(if($diagnostics.diagnostics.adminSdkStatus.isAvailable) { "Green" } else { "Red" })
    if ($diagnostics.diagnostics.adminSdkStatus.error) {
        Write-Host "  - Error: $($diagnostics.diagnostics.adminSdkStatus.error)" -ForegroundColor Red
    }
    
    Write-Host "Firebase Configuration:" -ForegroundColor Cyan
    Write-Host "  - Project ID: $($diagnostics.diagnostics.firebaseConfig.projectId)" -ForegroundColor White
    Write-Host "  - Has Service Account Key: $($diagnostics.diagnostics.firebaseConfig.hasServiceAccountKey)" -ForegroundColor $(if($diagnostics.diagnostics.firebaseConfig.hasServiceAccountKey) { "Green" } else { "Red" })
    
} catch {
    Write-Host "✗ Could not connect to server: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure the development server is running with 'npm run dev'" -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Green 