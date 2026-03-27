$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PaymentMigrationPath = Join-Path $RepoRoot "supabase\migrations\20260326002_enforce_order_payment_rules_in_db.sql"
$HistoryMigrationPath = Join-Path $RepoRoot "supabase\migrations\20260326003_enforce_order_history_in_db.sql"
$OwnerId = "11111111-1111-4111-8111-111111111111"
$OtherUserId = "22222222-2222-4222-8222-222222222222"
$BusinessId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
$OtherBusinessId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
$PublicOrderId = "33333333-3333-4333-8333-333333333333"
$ManualOrderId = "44444444-4444-4444-8444-444444444444"
$Port = 55432
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

function Assert-HistoryContract {
  param(
    [Parameter(Mandatory = $true)]
    $ActualHistory,
    [Parameter(Mandatory = $true)]
    [array]$ExpectedHistory,
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  $actualProjection = @($ActualHistory | ForEach-Object {
      [pscustomobject]@{
        title = $_.title
        description = $_.description
      }
    })

  $expectedProjection = @($ExpectedHistory | ForEach-Object {
      [pscustomobject]@{
        title = $_.title
        description = $_.description
      }
    })

  $actualJson = ConvertTo-Json $actualProjection -Compress -Depth 10
  $expectedJson = ConvertTo-Json $expectedProjection -Compress -Depth 10

  if ($actualJson -ne $expectedJson) {
    throw "$Message`nEsperado: $expectedJson`nActual: $actualJson"
  }
}

$initdbPath = Get-PostgresExecutablePath -BinaryName "initdb"
$postgresPath = Get-PostgresExecutablePath -BinaryName "postgres"
$psqlPath = Get-PostgresExecutablePath -BinaryName "psql"

Assert-True -Condition ([bool]$initdbPath) -Message "No se encontro initdb.exe para la prueba real de DB."
Assert-True -Condition ([bool]$postgresPath) -Message "No se encontro postgres.exe para la prueba real de DB."
Assert-True -Condition ([bool]$psqlPath) -Message "No se encontro psql.exe para la prueba real de DB."

$tempRoot = Join-Path $RepoRoot ".tmp"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$clusterRoot = Join-Path $tempRoot ("orders-history-db-" + [Guid]::NewGuid().ToString("N").Substring(0, 8))
$dataDir = Join-Path $clusterRoot "data"
$bootstrapPath = Join-Path $clusterRoot "bootstrap.sql"
$stdoutPath = Join-Path $clusterRoot "postgres.out.log"
$stderrPath = Join-Path $clusterRoot "postgres.err.log"
$serverProcess = $null

$paymentMigrationSource = Get-Content -Raw -Path $PaymentMigrationPath
$historyMigrationSource = Get-Content -Raw -Path $HistoryMigrationPath
$productsJsonb = ConvertTo-SqlJsonb @(
  @{
    productId = "prod-1"
    name = "Hamburguesa"
    quantity = 1
    unitPrice = 15000
  }
)

$expectedPublicHistory = @(
  @{
    title = "Pedido creado desde formulario publico"
    description = "El cliente confirmo el pedido desde el formulario publico compartido del negocio."
  },
  @{
    title = "Pedido registrado"
    description = "El pedido publico quedo persistido en la base principal del MVP."
  }
)

$expectedManualHistory = @(
  @{
    title = "Pedido creado manualmente"
    description = "El equipo del negocio registro el pedido manualmente desde el workspace privado."
  },
  @{
    title = "Pedido registrado"
    description = "El pedido manual quedo persistido en la base principal del MVP."
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
  customer_id uuid null,
  customer_name text not null,
  customer_whatsapp text null,
  delivery_type text not null,
  delivery_address text null,
  payment_method text not null,
  notes text null,
  total numeric not null,
  status text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  products jsonb not null default '[]'::jsonb,
  payment_status text null,
  date_label text null,
  is_reviewed boolean not null default false,
  history jsonb not null default '[]'::jsonb,
  inserted_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select on public.businesses to anon, authenticated;
grant insert on public.businesses to authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.orders to authenticated;
grant insert on public.orders to anon, authenticated;
grant update on public.orders to authenticated;

alter table public.businesses enable row level security;
alter table public.orders enable row level security;

drop policy if exists "public can read businesses" on public.businesses;
create policy "public can read businesses"
  on public.businesses
  for select
  using (true);

drop policy if exists "authenticated can read accessible orders" on public.orders;
create policy "authenticated can read accessible orders"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.created_by_user_id = auth.uid()
    )
  );
'@,
    $paymentMigrationSource,
    $historyMigrationSource,
@"
insert into public.businesses (id, slug, created_by_user_id)
values
  ($(ConvertTo-SqlText $BusinessId)::uuid, 'mi-tienda', $(ConvertTo-SqlText $OwnerId)::uuid),
  ($(ConvertTo-SqlText $OtherBusinessId)::uuid, 'otra-tienda', $(ConvertTo-SqlText $OtherUserId)::uuid);
"@
  ) -join "`n"

  Write-Utf8File -Path $bootstrapPath -Content $bootstrapSql
  Invoke-PostgresSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql $bootstrapSql | Out-Null

  $createdAt = "2026-03-26T18:00:00.000Z"
  $insertWithFakeHistoryResult = Invoke-PostgresSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "anon" -Sql @"
insert into public.orders (
  id,
  order_code,
  business_id,
  customer_name,
  customer_whatsapp,
  delivery_type,
  delivery_address,
  payment_method,
  notes,
  total,
  products,
  created_at,
  updated_at,
  inserted_at,
  history
)
values (
  $(ConvertTo-SqlText "55555555-5555-4555-8555-555555555555")::uuid,
  'WEB-555555',
  $(ConvertTo-SqlText $BusinessId)::uuid,
  'Ana Perez',
  '3001234567',
  'domicilio',
  'Calle 1 # 2-3',
  'Nequi',
  'Sin cebolla',
  15000,
  $productsJsonb,
  $(ConvertTo-SqlText $createdAt)::timestamptz,
  $(ConvertTo-SqlText $createdAt)::timestamptz,
  $(ConvertTo-SqlText $createdAt)::timestamptz,
  $(ConvertTo-SqlJsonb @(@{
        id = "fake"
        title = "Fake"
        description = "Fake"
        occurredAt = $createdAt
      }))
);
"@) -AllowFailure
  Assert-True -Condition ($insertWithFakeHistoryResult.ExitCode -ne 0) -Message "El insert directo con history arbitrario debio fallar."
  Assert-Match -Text $insertWithFakeHistoryResult.Output -Pattern "history es server-generated" -Message "DB debe rechazar history inicial arbitrario."

  Invoke-PostgresSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "anon" -Sql @"
insert into public.orders (
  id,
  order_code,
  business_id,
  customer_name,
  customer_whatsapp,
  delivery_type,
  delivery_address,
  payment_method,
  notes,
  total,
  products,
  created_at,
  updated_at,
  inserted_at
)
values (
  $(ConvertTo-SqlText $PublicOrderId)::uuid,
  'WEB-333333',
  $(ConvertTo-SqlText $BusinessId)::uuid,
  'Ana Perez',
  '3001234567',
  'domicilio',
  'Calle 1 # 2-3',
  'Nequi',
  'Sin cebolla',
  15000,
  $productsJsonb,
  '2026-03-26T18:05:00.000Z'::timestamptz,
  '2026-03-26T18:05:00.000Z'::timestamptz,
  '2026-03-26T18:05:00.000Z'::timestamptz
);
"@) | Out-Null

  $publicInsertResult = Invoke-JsonSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql @"
select json_build_object(
  'status', status,
  'paymentStatus', payment_status,
  'history', history
)::text
from public.orders
where id = $(ConvertTo-SqlText $PublicOrderId)::uuid;
"@
  Assert-Equal -Actual $publicInsertResult.status -Expected "pendiente de pago" -Message "DB debe derivar el estado inicial del pedido publico."
  Assert-Equal -Actual $publicInsertResult.paymentStatus -Expected "pendiente" -Message "DB debe derivar el estado inicial del pago publico."
  Assert-HistoryContract -ActualHistory $publicInsertResult.history -ExpectedHistory $expectedPublicHistory -Message "DB debe generar el historial inicial publico correcto."

  $manualInsertResult = Invoke-JsonSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "authenticated" -UserId $OwnerId -Sql @"
with inserted_order as (
  insert into public.orders (
    id,
    order_code,
    business_id,
    customer_name,
    customer_whatsapp,
    delivery_type,
    delivery_address,
    payment_method,
    notes,
    total,
    products,
    created_at,
    updated_at,
    inserted_at
  )
  values (
    $(ConvertTo-SqlText $ManualOrderId)::uuid,
    'WEB-444444',
    $(ConvertTo-SqlText $BusinessId)::uuid,
    'Carlos Diaz',
    '3009998888',
    'domicilio',
    'Carrera 7 # 8-9',
    'Efectivo',
    'Entrega inmediata',
    15000,
    $productsJsonb,
    '2026-03-26T18:10:00.000Z'::timestamptz,
    '2026-03-26T18:10:00.000Z'::timestamptz,
    '2026-03-26T18:10:00.000Z'::timestamptz
  )
  returning status, payment_status, history
)
select json_build_object(
  'status', status,
  'paymentStatus', payment_status,
  'history', history
)::text
from inserted_order;
"@)
  Assert-Equal -Actual $manualInsertResult.status -Expected "confirmado" -Message "DB debe derivar el estado inicial del pedido manual."
  Assert-Equal -Actual $manualInsertResult.paymentStatus -Expected "verificado" -Message "DB debe derivar el estado inicial del pago manual."
  Assert-HistoryContract -ActualHistory $manualInsertResult.history -ExpectedHistory $expectedManualHistory -Message "DB debe generar el historial inicial manual correcto."

  $replaceHistoryResult = Invoke-PostgresSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "authenticated" -UserId $OwnerId -Sql @"
update public.orders
set history = $(ConvertTo-SqlJsonb @(@{
      id = "fake-2"
      title = "History falso"
      description = "No debe persistir"
      occurredAt = "2026-03-26T18:11:00.000Z"
    }))
where id = $(ConvertTo-SqlText $ManualOrderId)::uuid;
"@) -AllowFailure
  Assert-True -Condition ($replaceHistoryResult.ExitCode -ne 0) -Message "El replace directo de history debio fallar."
  Assert-Match -Text $replaceHistoryResult.Output -Pattern "history es append-only" -Message "DB debe bloquear el reemplazo directo de history."

  $directTrackedUpdateResult = Invoke-PostgresSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "authenticated" -UserId $OwnerId -Sql @"
update public.orders
set notes = 'Cambio directo no permitido'
where id = $(ConvertTo-SqlText $ManualOrderId)::uuid;
"@) -AllowFailure
  Assert-True -Condition ($directTrackedUpdateResult.ExitCode -ne 0) -Message "El update directo de campos trazables debio fallar."
  Assert-Match -Text $directTrackedUpdateResult.Output -Pattern "campos trazables del pedido solo pueden mutarse desde public\.update_order_with_server_history" -Message "DB debe bloquear updates trazables fuera de la funcion controlada."

  $controlledUpdateResult = Invoke-JsonSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "authenticated" -UserId $OwnerId -Sql @"
select row_to_json(updated_order)::text
from public.update_order_with_server_history(
  $(ConvertTo-SqlText $ManualOrderId)::uuid,
  $(ConvertTo-SqlJsonb @{
      notes = "Se solicito comprobante"
      eventIntent = "request_payment_proof_whatsapp"
    })
) as updated_order;
"@)
  Assert-Equal -Actual $controlledUpdateResult.notes -Expected "Se solicito comprobante" -Message "La funcion controlada debe persistir el cambio valido."
  Assert-Equal -Actual $controlledUpdateResult.history[0].title -Expected "Mensaje de comprobante preparado para WhatsApp" -Message "La funcion controlada debe anexar el evento server-side correcto."
  Assert-Equal -Actual $controlledUpdateResult.history[1].field -Expected "notes" -Message "La funcion controlada debe anexar el cambio trazable al historial."
  Assert-True -Condition ($controlledUpdateResult.history.Count -ge 4) -Message "La funcion controlada debe conservar el historial append-only."

  $foreignUserResult = Invoke-PostgresSql -PsqlPath $psqlPath -ClusterRoot $clusterRoot -Sql (Wrap-AsRole -Role "authenticated" -UserId $OtherUserId -Sql @"
select row_to_json(updated_order)::text
from public.update_order_with_server_history(
  $(ConvertTo-SqlText $ManualOrderId)::uuid,
  $(ConvertTo-SqlJsonb @{ notes = "Intento ajeno" })
) as updated_order;
"@) -AllowFailure
  Assert-True -Condition ($foreignUserResult.ExitCode -ne 0) -Message "Un usuario ajeno no debe poder usar la funcion controlada."
  Assert-Match -Text $foreignUserResult.Output -Pattern "Order not found|permission denied" -Message "La funcion controlada debe seguir respetando ownership."

  Write-Host "orders-history-db-integration: OK"
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }

  if (Test-Path $clusterRoot) {
    Remove-Item -Recurse -Force -Path $clusterRoot
  }
}
