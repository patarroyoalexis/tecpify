$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$MigrationsDir = Join-Path $RepoRoot "supabase\migrations"
$OwnerId = "11111111-1111-4111-8111-111111111111"
$OtherUserId = "22222222-2222-4222-8222-222222222222"
$BusinessId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
$OtherBusinessId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
$UnusedProductId = "33333333-3333-4333-8333-333333333333"
$UsedCanonicalProductId = "44444444-4444-4444-8444-444444444444"
$UsedLegacyProductId = "55555555-5555-4555-8555-555555555555"
$CanonicalOrderId = "66666666-6666-4666-8666-666666666666"
$LegacyOrderId = "77777777-7777-4777-8777-777777777777"
$Port = 55433
$SqlCounter = 0

function Get-PostgresExecutablePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BinaryName
  )

  $command = Get-Command $BinaryName -ErrorAction SilentlyContinue

  if ($command) {
    return $command.Source
  }

  $programFilesRoots = @($env:ProgramFiles, $env:ProgramFiles_x86, ${env:ProgramFiles(x86)}) |
    Where-Object { $_ }

  foreach ($root in $programFilesRoots) {
    $postgresRoot = Join-Path $root "PostgreSQL"

    if (-not (Test-Path $postgresRoot)) {
      continue
    }

    $versions = Get-ChildItem -Path $postgresRoot -Directory | Sort-Object Name -Descending

    foreach ($version in $versions) {
      $candidate = Join-Path $version.FullName "bin\$BinaryName.exe"

      if (Test-Path $candidate) {
        return $candidate
      }
    }
  }

  return $null
}

function Assert-True {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Condition,
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Assert-Equal {
  param(
    $Actual,
    $Expected,
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if ($Actual -ne $Expected) {
    throw "$Message`nEsperado: $Expected`nActual: $Actual"
  }
}

function Assert-Match {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [Parameter(Mandatory = $true)]
    [string]$Pattern,
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if ($Text -notmatch $Pattern) {
    throw "$Message`nPatron: $Pattern`nTexto: $Text"
  }
}

function ConvertTo-SqlText {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string]$Value
  )

  return "'" + $Value.Replace("'", "''") + "'"
}

function ConvertTo-SqlJsonb {
  param(
    [Parameter(Mandatory = $true)]
    $Value
  )

  $json = ConvertTo-Json $Value -Compress -Depth 10
  return "'" + $json.Replace("'", "''") + "'::jsonb"
}

function Get-ServerLog {
  param(
    [Parameter(Mandatory = $true)]
    [string]$StdOutPath,
    [Parameter(Mandatory = $true)]
    [string]$StdErrPath
  )

  $content = @()

  if (Test-Path $StdOutPath) {
    $content += Get-Content -Raw -Path $StdOutPath
  }

  if (Test-Path $StdErrPath) {
    $content += Get-Content -Raw -Path $StdErrPath
  }

  return ($content -join "`n").Trim()
}

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Get-LatestMigrationPathByPattern {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Pattern
  )

  $candidates = Get-ChildItem -Path $MigrationsDir -Filter *.sql |
    Sort-Object Name |
    Where-Object {
      (Get-Content -Raw -Path $_.FullName) -match $Pattern
    }

  $latest = $candidates | Select-Object -Last 1

  Assert-True -Condition ([bool]$latest) -Message "No se encontro una migracion para el patron: $Pattern"

  return $latest.FullName
}

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"

  try {
    $output = & $Command @Arguments 2>&1 | ForEach-Object { "$_" } | Out-String
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return @{
    ExitCode = $exitCode
    Output = $output.Trim()
  }
}

function Invoke-PostgresSql {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PsqlPath,
    [Parameter(Mandatory = $true)]
    [string]$ClusterRoot,
    [Parameter(Mandatory = $true)]
    [string]$Sql,
    [switch]$AllowFailure
  )

  $script:SqlCounter += 1
  $sqlPath = Join-Path $ClusterRoot ("query-$script:SqlCounter.sql")
  Write-Utf8File -Path $sqlPath -Content ($Sql.Trim() + "`n")

  $nativeResult = Invoke-NativeCommand -Command $PsqlPath -Arguments @(
    "-X",
    "-q",
    "-t",
    "-A",
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    "127.0.0.1",
    "-p",
    "$Port",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-f",
    $sqlPath
  )

  if (-not $AllowFailure -and $nativeResult.ExitCode -ne 0) {
    throw "psql fallo.`n$($nativeResult.Output)"
  }

  return @{
    ExitCode = $nativeResult.ExitCode
    Output = $nativeResult.Output
  }
}

function Invoke-JsonSql {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PsqlPath,
    [Parameter(Mandatory = $true)]
    [string]$ClusterRoot,
    [Parameter(Mandatory = $true)]
    [string]$Sql
  )

  $result = Invoke-PostgresSql -PsqlPath $PsqlPath -ClusterRoot $ClusterRoot -Sql $Sql
  $lastLine = $result.Output -split "\r?\n" | Where-Object { $_.Trim().Length -gt 0 } | Select-Object -Last 1

  Assert-True -Condition ([bool]$lastLine) -Message "La consulta SQL no devolvio un JSON valido."
  return $lastLine | ConvertFrom-Json
}

function Wrap-AsRole {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("anon", "authenticated")]
    [string]$Role,
    [string]$UserId,
    [Parameter(Mandatory = $true)]
    [string]$Sql
  )

  $normalizedUserId = if ($null -eq $UserId) { "" } else { [string]$UserId }

  return @"
select set_config('request.jwt.claim.role', $(ConvertTo-SqlText $Role), false);
select set_config('request.jwt.claim.sub', $(ConvertTo-SqlText $normalizedUserId), false);
set role $Role;
$Sql
reset role;
"@
}

$initdbPath = Get-PostgresExecutablePath -BinaryName "initdb"
$postgresPath = Get-PostgresExecutablePath -BinaryName "postgres"
$psqlPath = Get-PostgresExecutablePath -BinaryName "psql"

Assert-True -Condition ([bool]$initdbPath) -Message "No se encontro initdb.exe para la prueba real de DB."
Assert-True -Condition ([bool]$postgresPath) -Message "No se encontro postgres.exe para la prueba real de DB."
Assert-True -Condition ([bool]$psqlPath) -Message "No se encontro psql.exe para la prueba real de DB."

$tempRoot = Join-Path $RepoRoot ".tmp"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$clusterRoot = Join-Path $tempRoot ("products-delete-db-" + [Guid]::NewGuid().ToString("N").Substring(0, 8))
$dataDir = Join-Path $clusterRoot "data"
$bootstrapPath = Join-Path $clusterRoot "bootstrap.sql"
$stdoutPath = Join-Path $clusterRoot "postgres.out.log"
$stderrPath = Join-Path $clusterRoot "postgres.err.log"
$serverProcess = $null

$grantsMigrationSource = Get-Content -Raw -Path (Get-LatestMigrationPathByPattern -Pattern "grant\s+insert,\s*update,\s*delete\s+on\s+public\.products\s+to\s+authenticated")
$baseOwnershipRlsMigrationSource = Get-Content -Raw -Path (Get-LatestMigrationPathByPattern -Pattern "alter\s+table\s+public\.products\s+enable\s+row\s+level\s+security")
$effectiveOwnershipPoliciesSource = Get-Content -Raw -Path (Get-LatestMigrationPathByPattern -Pattern 'create\s+policy\s+"authenticated can delete accessible products"')
$productDeleteGuardMigrationSource = Get-Content -Raw -Path (Get-LatestMigrationPathByPattern -Pattern "create\s+(?:or\s+replace\s+)?function\s+public\.products_block_delete_when_referenced_by_orders")

$canonicalOrderProductsJsonb = ConvertTo-SqlJsonb @(
  @{
    productId = $UsedCanonicalProductId
    name = "Hamburguesa clasica"
    quantity = 1
    unitPrice = 15000
  }
)
$legacyOrderProductsJsonb = ConvertTo-SqlJsonb @(
  @{
    product_id = $UsedLegacyProductId
    name = "Hamburguesa legacy"
    quantity = 2
    unitPrice = 12000
  }
)

try {
  New-Item -ItemType Directory -Force -Path $clusterRoot | Out-Null

  $initdbResult = Invoke-NativeCommand -Command $initdbPath -Arguments @(
    "-D",
    $dataDir,
    "-A",
    "trust",
    "-U",
    "postgres",
    "-E",
    "UTF8"
  )
  if ($initdbResult.ExitCode -ne 0) {
    throw "initdb fallo.`n$($initdbResult.Output)"
  }

  $postgresArgs = "-D `"$dataDir`" -p $Port"
  $serverProcess = Start-Process -FilePath $postgresPath -ArgumentList $postgresArgs -WorkingDirectory $clusterRoot -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 80; $attempt += 1) {
    Start-Sleep -Milliseconds 250

    if ($serverProcess.HasExited) {
      $serverLog = Get-ServerLog -StdOutPath $stdoutPath -StdErrPath $stderrPath
      throw "postgres.exe termino antes de quedar listo.`n$serverLog"
    }

    $readyProbeResult = Invoke-NativeCommand -Command $psqlPath -Arguments @(
      "-X",
      "-q",
      "-t",
      "-A",
      "-h",
      "127.0.0.1",
      "-p",
      "$Port",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-c",
      "select 1;"
    )

    if ($readyProbeResult.ExitCode -eq 0) {
      $ready = $true
      break
    }
  }

  Assert-True -Condition $ready -Message ("postgres.exe no quedo listo a tiempo.`n" + (Get-ServerLog -StdOutPath $stdoutPath -StdErrPath $stderrPath))

  $bootstrapSql = @(
@'
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user);
$$;

grant usage on schema auth to public, anon, authenticated;
grant execute on function auth.uid() to public, anon, authenticated;
grant execute on function auth.role() to public, anon, authenticated;

create table if not exists public.businesses (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid null
);

create table if not exists public.products (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text null,
  price numeric not null,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key,
  order_code text not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  products jsonb not null default '[]'::jsonb
);
'@,
    $baseOwnershipRlsMigrationSource,
    $effectiveOwnershipPoliciesSource,
    $grantsMigrationSource,
    $productDeleteGuardMigrationSource,
@"
insert into public.businesses (id, slug, name, created_by_user_id)
values
  ($(ConvertTo-SqlText $BusinessId)::uuid, 'mi-tienda', 'Mi tienda', $(ConvertTo-SqlText $OwnerId)::uuid),
  ($(ConvertTo-SqlText $OtherBusinessId)::uuid, 'otra-tienda', 'Otra tienda', $(ConvertTo-SqlText $OtherUserId)::uuid);

insert into public.products (id, business_id, name, description, price, sort_order)
values
  ($(ConvertTo-SqlText $UnusedProductId)::uuid, $(ConvertTo-SqlText $BusinessId)::uuid, 'Producto libre', null, 9000, 1),
  ($(ConvertTo-SqlText $UsedCanonicalProductId)::uuid, $(ConvertTo-SqlText $BusinessId)::uuid, 'Hamburguesa clasica', null, 15000, 2),
  ($(ConvertTo-SqlText $UsedLegacyProductId)::uuid, $(ConvertTo-SqlText $BusinessId)::uuid, 'Hamburguesa legacy', null, 12000, 3);

insert into public.orders (id, order_code, business_id, customer_name, products)
values
  (
    $(ConvertTo-SqlText $CanonicalOrderId)::uuid,
    'WEB-666666',
    $(ConvertTo-SqlText $BusinessId)::uuid,
    'Ana Perez',
    $canonicalOrderProductsJsonb
  ),
  (
    $(ConvertTo-SqlText $LegacyOrderId)::uuid,
    'WEB-777777',
    $(ConvertTo-SqlText $BusinessId)::uuid,
    'Carlos Diaz',
    $legacyOrderProductsJsonb
  );
"@
  ) -join "`n"

  Write-Utf8File -Path $bootstrapPath -Content $bootstrapSql
  Invoke-PostgresSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql $bootstrapSql | Out-Null

  $deletedUnusedProduct = Invoke-JsonSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "authenticated" -UserId $OwnerId -Sql @"
with deleted_product as (
  delete from public.products
  where id = $(ConvertTo-SqlText $UnusedProductId)::uuid
  returning id, name
)
select json_build_object(
  'id', id,
  'name', name
)::text
from deleted_product;
"@)
  Assert-Equal -Actual $deletedUnusedProduct.id -Expected $UnusedProductId -Message "Un producto sin uso historico debe poder borrarse."
  Assert-Equal -Actual $deletedUnusedProduct.name -Expected "Producto libre" -Message "El delete permitido debe devolver el producto correcto."

  $unusedProductAfterDelete = Invoke-JsonSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql @"
select json_build_object(
  'stillExists', exists (
    select 1
    from public.products
    where id = $(ConvertTo-SqlText $UnusedProductId)::uuid
  )
)::text;
"@
  Assert-Equal -Actual $unusedProductAfterDelete.stillExists -Expected $false -Message "El producto sin uso historico debe desaparecer despues del delete valido."

  $blockedCanonicalDelete = Invoke-PostgresSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "authenticated" -UserId $OwnerId -Sql @"
delete from public.products
where id = $(ConvertTo-SqlText $UsedCanonicalProductId)::uuid;
"@) -AllowFailure
  Assert-True -Condition ($blockedCanonicalDelete.ExitCode -ne 0) -Message "El delete directo del producto ya usado debio fallar."
  Assert-Match -Text $blockedCanonicalDelete.Output -Pattern 'No puedes borrar "Hamburguesa clasica"' -Message "La DB debe emitir el error canonico para el producto usado con productId."
  Assert-Match -Text $blockedCanonicalDelete.Output -Pattern "historico.*persistido" -Message "La DB debe dejar claro que protege pedidos historicos persistidos."

  $blockedLegacyDelete = Invoke-PostgresSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "authenticated" -UserId $OwnerId -Sql @"
delete from public.products
where id = $(ConvertTo-SqlText $UsedLegacyProductId)::uuid;
"@) -AllowFailure
  Assert-True -Condition ($blockedLegacyDelete.ExitCode -ne 0) -Message "El delete directo del producto historico legacy debio fallar."
  Assert-Match -Text $blockedLegacyDelete.Output -Pattern 'No puedes borrar "Hamburguesa legacy"' -Message "La DB debe bloquear tambien snapshots legacy con product_id."

  $integrityAfterBlockedDeletes = Invoke-JsonSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql @"
select json_build_object(
  'canonicalProductExists', exists (
    select 1
    from public.products
    where id = $(ConvertTo-SqlText $UsedCanonicalProductId)::uuid
  ),
  'legacyProductExists', exists (
    select 1
    from public.products
    where id = $(ConvertTo-SqlText $UsedLegacyProductId)::uuid
  ),
  'canonicalOrderProducts', (
    select products
    from public.orders
    where id = $(ConvertTo-SqlText $CanonicalOrderId)::uuid
  ),
  'legacyOrderProducts', (
    select products
    from public.orders
    where id = $(ConvertTo-SqlText $LegacyOrderId)::uuid
  )
)::text;
"@
  Assert-Equal -Actual $integrityAfterBlockedDeletes.canonicalProductExists -Expected $true -Message "El veto en DB no debe borrar el producto ya referenciado."
  Assert-Equal -Actual $integrityAfterBlockedDeletes.legacyProductExists -Expected $true -Message "El veto en DB tampoco debe borrar el producto legacy referenciado."
  Assert-Equal -Actual $integrityAfterBlockedDeletes.canonicalOrderProducts[0].productId -Expected $UsedCanonicalProductId -Message "El intento bloqueado no debe mutar el snapshot historico canonico."
  Assert-Equal -Actual $integrityAfterBlockedDeletes.legacyOrderProducts[0].product_id -Expected $UsedLegacyProductId -Message "El intento bloqueado no debe mutar el snapshot historico legacy."

  Write-Host "products-delete-db-integration: OK"
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }

  if (Test-Path $clusterRoot) {
    Remove-Item -Recurse -Force -Path $clusterRoot
  }
}
