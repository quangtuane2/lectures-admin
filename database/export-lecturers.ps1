param(
  [string]$ProjectDir = (Split-Path -Parent $PSScriptRoot),
  [string]$OutputPath = (Join-Path $PSScriptRoot 'GiangVien.json')
)

$ErrorActionPreference = 'Stop'

$config = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $ProjectDir '.env')) {
  if ($line -match '^\s*(EXPO_PUBLIC_FIREBASE_[A-Z_]+)\s*=\s*(.*?)\s*$') {
    $config[$Matches[1]] = $Matches[2].Trim('"', "'")
  }
}
$projectId = $config['EXPO_PUBLIC_FIREBASE_PROJECT_ID']
$apiKey = $config['EXPO_PUBLIC_FIREBASE_API_KEY']
if (!$projectId -or !$apiKey) { throw 'Missing Firebase project ID or API key in .env.' }

$email = Read-Host 'Email admin Firebase'
$password = Read-Host 'Mat khau admin Firebase' -AsSecureString
try {
  $login = Invoke-RestMethod -Method Post -ContentType 'application/json' -Uri (
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + $apiKey
  ) -Body (@{
    email = $email.Trim()
    password = [System.Net.NetworkCredential]::new('', $password).Password
    returnSecureToken = $true
  } | ConvertTo-Json -Compress) -TimeoutSec 30
} catch {
  throw 'Firebase login failed. Check your email, password and Internet connection.'
} finally {
  $password.Dispose()
}

$headers = @{ Authorization = 'Bearer ' + $login.idToken }
$endpoint = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/QLHocPhan/QuanLy/GiangVien"
$lecturers = [System.Collections.Generic.List[object]]::new()
$pageToken = $null

do {
  $uri = $endpoint + '?pageSize=50'
  if ($pageToken) { $uri += '&pageToken=' + [Uri]::EscapeDataString($pageToken) }
  try {
    $page = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 30
  } catch {
    throw 'Cannot read Firestore GiangVien. Check admin access and the Internet connection.'
  }
  foreach ($document in $page.documents) {
    $fields = $document.fields
    $lecturers.Add([ordered]@{
      IDGV = $fields.IDGV.stringValue
      Fullname = $fields.Fullname.stringValue
      Image = $fields.Image.stringValue
      SumClass = [long]$fields.SumClass.integerValue
    })
  }
  $pageToken = $page.nextPageToken
} while ($pageToken)

$json = ConvertTo-Json -InputObject ($lecturers.ToArray()) -Depth 4
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Write-Host "Exported $($lecturers.Count) lecturer(s) to $OutputPath"
