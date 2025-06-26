# PowerShell script to set up Firebase environment variables
# This script will create/update the .env.local file with the correct Firebase configuration

# Create the content for .env.local
$envContent = @"
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyB9w0Ryf0kZRGmzSnj8t2Oo-1o3OPgnCaI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=consortdigital-327d9.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=consortdigital-327d9
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=consortdigital-327d9.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=545144758087
NEXT_PUBLIC_FIREBASE_APP_ID=1:545144758087:web:04e37c0c8eaa05ed1e3662
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-BW2XBY41V9

# Firebase Admin SDK Configuration
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@consortdigital-327d9.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCl7dGMVlEV257+\nBuVnKm09IGKiX1EleUrid5f/yEkkuIUAABaFPd7z+hf7GTOGdfoQFMnVea55N8cj\nZKawqr2KyZ8Zo2KK6vIKG0oZzLsbsZFoKCsX7+WU3zJ4LFizXykl3bKx9fw7ZqPG\nlV1JaWGl0vbI8HOEwF76LoMV66fFHvCp3eBOkgOjMLIRgA6qNAmQ/aAwAJ8iZumq\nInEDsbIZSyRxshtkVIx5TKulGG9IwcGgrVR0EKalVMRbE2UIougpkKybVhN5aGGX\nHDG9rhZgMKiaVhe+hzDwYSRzG7oFyd0pilwJFZ5wYEjunaTCgr5aPwyBLNx8FuOn\n+yDwF8f7AgMBAAECggEANe84ImQ6Rh8Vrp+iOKb/TBO3S+0srMAg2b0jAKbjM5bw\n0F+28kd6rZZY7isyZt35UvnW41eCoW9CgRwp3JobMz43Q3eqw9n7o9JcA0fbd/R/\nfbo0y7qURxBH0O0lReTENMU73QHGo65IxPdvE7o33dVVl1olSnzXQn4U6O6pIXbX\ngSHAQjHiGBPSokM0J2VBZDKUX/+xzBM8SxbfLeLwjATAwL11Rt/Mb0qK8k5p38mg\nBX65Y956JMhMjOLTmq6q+EZg11Xhie8Z8L0K+f73GzQvShMViOJrXKl9E7kNE8q/\npiL4cT1fFhQT5/VYqA4bLRuEIvq8YOvO7gOi4JDejQKBgQDYZNWTpzSJJdxChcKP\nkVP0qFTxmAg1bBHPQUicvc68SNQp08JnmK+GP8WFA7IthbBapnwVX7U73CDja/RO\n0jc4NZH3IWR08uv9/mTF76QUBH8rN2/9JXpXYab3Eyj/P/dXNuviwHIAp+u1TN0w\nsMNtBEJe5UR7kDI3AUOBD99rRQKBgQDETHGuWYC++JS54mAZNnUIlF6TdqbAWSSy\n41eKJxvQr+mAUPZp8FIbVQeq9J2KZgeOarhVxGawdBozFSPNv2vgtVBufkFhSXvq\ndqEh358HhIG+r4LW0HNou0JoxiwgfuLLo0jx+L5vaJpV38hLGOgSZHENKkj4S94j\nhe7gLB/6PwKBgQDD2l/EB+3ww6ebPd1ee7Z1FXXsRCIJ2Ao2f2vtEY3vtCrywIqP\noQ4cf9OSFEpMEVgQc+aSodEyoIXT0H2KaZE4+qNl/X8iqksV1A35aHAk/fzrbH2b\nrTQRqnyn21ubypVfBoJw9KU6GsGnki4QR6xZGyXHJdLZ0yTfy/EA+xDH0QKBgAan\nBI9BD0Dpkbi++DzCgLLavF3I/pu0Ka86TyQqcSHgZExp8f/jGhU9C3Z6tcAT9xuX\neEnHzycZuC2VANKfMxu5aVFlS/ftEpr+jDVmq7AIiJEax5daFx8sgXKljKdJRYxb\nK0SwBlwmMlzIqbQJ0wuUhdRJY5GumIehqVfFhwvnAoGBALUx2fWviTeAcDVixAJA\n60omh6kPHy96Dty1nvWpeksl7pux/UnBr+OFgTOsQQBHcKis+lRB+Mou5LTyvonW\n9K1rKOWg37qwltsegR4kHLcue33v5meJcR/7XumPdaX6FXtJVCJLRZIAKanUxfR8\nDk9uMsnzFWo7cKQm1gW1ZzVO\n-----END PRIVATE KEY-----\n"
"@

# Ensure we're using UTF-8 encoding without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

# Write the content to .env.local
[System.IO.File]::WriteAllText(".env.local", $envContent, $utf8NoBom)

Write-Host "✅ Created .env.local file with Firebase configuration" -ForegroundColor Green

# Also set the environment variables for the current session
$env:NEXT_PUBLIC_FIREBASE_API_KEY = "AIzaSyB9w0Ryf0kZRGmzSnj8t2Oo-1o3OPgnCaI"
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "consortdigital-327d9.firebaseapp.com"
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = "consortdigital-327d9"
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "consortdigital-327d9.firebasestorage.app"
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "545144758087"
$env:NEXT_PUBLIC_FIREBASE_APP_ID = "1:545144758087:web:04e37c0c8eaa05ed1e3662"
$env:NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = "G-BW2XBY41V9"

Write-Host "✅ Set environment variables for current session" -ForegroundColor Green

# Kill any running Next.js processes and restart the development server
taskkill /F /IM node.exe 2>$null
Write-Host "🔄 Restarting Next.js development server..." -ForegroundColor Yellow
npm run dev 