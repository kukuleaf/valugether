$ErrorActionPreference = 'Stop'

$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $workspace 'apps\api\.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'apps/api/.env is required.'
}

$databaseLine = Get-Content -LiteralPath $envFile -Encoding utf8 |
  Where-Object { $_ -match '^DATABASE_URL=' } |
  Select-Object -First 1
if (-not $databaseLine) {
  throw 'DATABASE_URL is missing from apps/api/.env.'
}

$databaseUrl = [Uri]$databaseLine.Substring('DATABASE_URL='.Length).Trim()
$sourceDatabase = [Uri]::UnescapeDataString($databaseUrl.AbsolutePath.TrimStart('/'))
$userInfo = $databaseUrl.UserInfo.Split(':', 2)
$sourceUser = [Uri]::UnescapeDataString($userInfo[0])
$sourcePassword = if ($userInfo.Count -eq 2) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
if ($databaseUrl.Host -notin @('localhost', '127.0.0.1') -or $databaseUrl.Port -ne 5433) {
  throw 'Safety check failed: this command only supports the local Docker PostgreSQL on port 5433.'
}
if ($sourceDatabase -notmatch '^[a-zA-Z][a-zA-Z0-9_]{0,62}$') {
  throw 'DATABASE_URL contains an unsafe database name.'
}

$suffix = '{0}_{1}' -f (Get-Date -Format 'yyyyMMddHHmmss'), $PID
$restoreContainer = "stock-restore-check-$suffix"
$restoreDatabase = 'stock_restore_check'
$containerDump = "/tmp/$restoreContainer.dump"
$containerRestoreDump = '/tmp/stock_restore_check.dump'
$tempRoot = Join-Path $workspace '.tmp\backup-restore'
$hostDump = Join-Path $tempRoot "$restoreDatabase.dump"
$resolvedTempRoot = [IO.Path]::GetFullPath($tempRoot)
if (-not $resolvedTempRoot.StartsWith("$workspace\", [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Temporary backup path escaped the workspace.'
}

function Invoke-Docker([string[]]$Arguments) {
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker command failed with exit code $LASTEXITCODE"
  }
}

function Get-SourceScalar([string]$Sql) {
  $value = & docker compose exec -T -e "PGPASSWORD=$sourcePassword" postgres psql -h 127.0.0.1 -U $sourceUser -d $sourceDatabase -v ON_ERROR_STOP=1 -Atc $Sql
  if ($LASTEXITCODE -ne 0) {
    throw "source database validation query failed with exit code $LASTEXITCODE"
  }
  return ($value | Select-Object -Last 1).Trim()
}

function Get-RestoreScalar([string]$Sql) {
  $value = & docker exec $restoreContainer psql -U postgres -d $restoreDatabase -v ON_ERROR_STOP=1 -Atc $Sql
  if ($LASTEXITCODE -ne 0) {
    throw "restored database validation query failed with exit code $LASTEXITCODE"
  }
  return ($value | Select-Object -Last 1).Trim()
}

New-Item -ItemType Directory -Force -Path $resolvedTempRoot | Out-Null
$containerId = (& docker compose ps -q postgres).Trim()
if ($LASTEXITCODE -ne 0 -or -not $containerId) {
  throw 'The Docker Compose postgres service is not running.'
}

try {
  Invoke-Docker @('compose', 'exec', '-T', '-e', "PGPASSWORD=$sourcePassword", 'postgres', 'pg_dump', '-h', '127.0.0.1', '-U', $sourceUser, '-d', $sourceDatabase, '--format=custom', '--file', $containerDump)
  Invoke-Docker @('cp', "${containerId}:$containerDump", $hostDump)
  if ((Get-Item -LiteralPath $hostDump).Length -le 0) {
    throw 'Backup file is empty.'
  }

  Invoke-Docker @('compose', 'exec', '-T', 'postgres', 'rm', '-f', $containerDump)
  Invoke-Docker @('run', '--detach', '--name', $restoreContainer, '--env', 'POSTGRES_PASSWORD=restore_check_only', 'postgres:17-alpine')
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker exec $restoreContainer pg_isready -U postgres | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    throw 'Temporary restore PostgreSQL did not become ready within 30 seconds.'
  }

  Invoke-Docker @('cp', $hostDump, "${restoreContainer}:$containerRestoreDump")
  Invoke-Docker @('exec', $restoreContainer, 'createdb', '-U', 'postgres', $restoreDatabase)
  Invoke-Docker @('exec', $restoreContainer, 'pg_restore', '-U', 'postgres', '-d', $restoreDatabase, '--exit-on-error', '--no-owner', '--no-privileges', $containerRestoreDump)

  $sourceTables = Get-SourceScalar "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"
  $restoredTables = Get-RestoreScalar "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"
  $sourceCompanies = Get-SourceScalar 'select count(*) from company'
  $restoredCompanies = Get-RestoreScalar 'select count(*) from company'
  $sourceSecurities = Get-SourceScalar 'select count(*) from security'
  $restoredSecurities = Get-RestoreScalar 'select count(*) from security'

  if ($sourceTables -ne $restoredTables -or $sourceCompanies -ne $restoredCompanies -or $sourceSecurities -ne $restoredSecurities) {
    throw "Restore mismatch: tables $sourceTables/$restoredTables, companies $sourceCompanies/$restoredCompanies, securities $sourceSecurities/$restoredSecurities"
  }

  Write-Output "Backup/restore OK: tables=$restoredTables companies=$restoredCompanies securities=$restoredSecurities"
} finally {
  & docker compose exec -T postgres rm -f $containerDump | Out-Null
  & docker rm --force $restoreContainer | Out-Null
  if (Test-Path -LiteralPath $hostDump) {
    Remove-Item -LiteralPath $hostDump -Force
  }
}
