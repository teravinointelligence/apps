-- =============================================================================
-- TERAVINO · Punto de venta para eventos
-- Proyecto Supabase: teravino-crm
--
-- Qué agrega (todo nuevo, no modifica tablas existentes del CRM):
--   event_pos_config    Un POS por evento del CRM: almacén de origen, estado,
--                       prefijo de folio, CLABE para SPEI, descuento máximo.
--   event_pos_items     Lista de precios del evento (precio al público con IVA)
--                       y conciliación de botellas: salida, regreso,
--                       degustación y merma.
--   event_pos_sessions  Cajas abiertas (una caja no puede estar abierta en dos
--                       dispositivos a la vez).
--   event_pos_sales     Tickets cobrados. Se escriben solo por RPC.
--   event_pos_closings  Cortes de caja con arqueo. Se escriben solo por RPC.
--
-- Inventario: el POS NO descuenta product_warehouse_stock (lo sobrescribe la
-- carga de CONTPAQi). Las botellas se controlan como "salida a evento" y al
-- cerrar se concilia; el Excel del cierre es lo que se captura en CONTPAQi.
--
-- Permisos:
--   Leer:     rep, admin, contador y jefe_logistica activos.
--   Vender:   rep y admin activos (is_active_rep).
--   Preparar, anular y cerrar evento: admin, o el coordinador del evento.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Funciones de permiso
-- ---------------------------------------------------------------------------

create or replace function public.event_pos_can_read()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sales_reps
    where auth_user_id = auth.uid()
      and active = true
      and role in ('rep', 'admin', 'contador', 'jefe_logistica')
  );
$$;

create or replace function public.event_pos_can_manage(p_event uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_admin()
      or exists (
        select 1
        from public.events e
        join public.sales_reps r on r.id = e.coordinator_id
        where e.id = p_event
          and r.auth_user_id = auth.uid()
          and r.active = true
          and r.role in ('rep', 'admin')
      );
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.event_pos_config (
  event_id          uuid primary key references public.events(id) on delete cascade,
  status            text not null default 'preparando'
                    check (status in ('preparando', 'abierto', 'cerrado')),
  warehouse         text not null,
  folio_prefix      text not null check (folio_prefix ~ '^[A-Z0-9]{2,8}$'),
  descuento_max_pct numeric(5,2) not null default 10
                    check (descuento_max_pct between 0 and 100),
  spei_clabe        text check (spei_clabe is null or spei_clabe ~ '^[0-9]{18}$'),
  spei_banco        text,
  spei_titular      text,
  notas             text,
  created_by        uuid references public.sales_reps(id),
  created_at        timestamptz not null default now(),
  updated_by        uuid references public.sales_reps(id),
  updated_at        timestamptz not null default now(),
  closed_by         uuid references public.sales_reps(id),
  closed_at         timestamptz
);

comment on table public.event_pos_config is
  'POS de eventos: configuración por evento (almacén de origen, estado, folio, SPEI).';

create table if not exists public.event_pos_items (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.event_pos_config(event_id) on delete cascade,
  product_id       uuid not null references public.products(id),
  sku              text not null,
  codigo_contpaqi  text,
  name             text not null,
  category         text,
  vintage          text,
  volume_ml        integer,
  precio           numeric(12,2) not null check (precio > 0),
  salida           integer not null default 0 check (salida >= 0),
  regreso          integer check (regreso >= 0),
  degustacion      integer check (degustacion >= 0),
  merma            integer check (merma >= 0),
  sort_order       integer not null default 0,
  active           boolean not null default true,
  updated_by       uuid references public.sales_reps(id),
  updated_at       timestamptz not null default now(),
  unique (event_id, product_id)
);

comment on table public.event_pos_items is
  'POS de eventos: lista de precios al público (con IVA) y conciliación de botellas por evento.';
comment on column public.event_pos_items.precio is 'Precio al público con IVA incluido.';
comment on column public.event_pos_items.salida is 'Botellas que salieron del almacén al evento.';

create table if not exists public.event_pos_sessions (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.event_pos_config(event_id) on delete cascade,
  caja         text not null check (caja ~ '^CAJA-[1-9]$'),
  device_id    text not null,
  seller_id    uuid not null references public.sales_reps(id),
  seller_name  text not null,
  fondo        numeric(12,2) not null default 0 check (fondo >= 0),
  opened_at    timestamptz not null default now(),
  closed_at    timestamptz,
  closed_reason text
);

create unique index if not exists event_pos_sessions_una_abierta
  on public.event_pos_sessions (event_id, caja) where closed_at is null;

create table if not exists public.event_pos_sales (
  id            text primary key check (length(id) between 6 and 64),
  event_id      uuid not null references public.event_pos_config(event_id),
  session_id    uuid references public.event_pos_sessions(id),
  folio         text not null,
  caja          text not null,
  at            timestamptz not null,
  seller_id     uuid not null references public.sales_reps(id),
  seller_name   text not null,
  customer      jsonb,
  lines         jsonb not null,
  subtotal      numeric(12,2) not null,
  discount      numeric(12,2) not null default 0,
  discount_pct  numeric(5,2),
  iva           numeric(12,2) not null,
  total         numeric(12,2) not null check (total >= 0),
  method        text not null check (method in ('Efectivo', 'Tarjeta', 'SPEI')),
  received      numeric(12,2),
  change        numeric(12,2),
  card_ref      text,
  needs_review  boolean not null default false,
  review_notes  jsonb not null default '[]'::jsonb,
  voided_at     timestamptz,
  voided_by     uuid references public.sales_reps(id),
  void_reason   text,
  recorded_by   uuid,
  recorded_at   timestamptz not null default now()
);

create index if not exists event_pos_sales_event_at on public.event_pos_sales (event_id, at);

comment on table public.event_pos_sales is
  'POS de eventos: tickets cobrados. Solo se escriben con event_pos_record_sale (idempotente por id).';

create table if not exists public.event_pos_closings (
  id                 uuid primary key default gen_random_uuid(),
  client_id          text not null unique,
  event_id           uuid not null references public.event_pos_config(event_id),
  session_id         uuid references public.event_pos_sessions(id),
  caja               text not null,
  seller_id          uuid not null references public.sales_reps(id),
  seller_name        text not null,
  fondo              numeric(12,2) not null default 0,
  tickets            integer not null default 0,
  total              numeric(12,2) not null default 0,
  efectivo           numeric(12,2) not null default 0,
  tarjeta            numeric(12,2) not null default 0,
  spei               numeric(12,2) not null default 0,
  efectivo_esperado  numeric(12,2) not null default 0,
  efectivo_contado   numeric(12,2) not null default 0,
  diferencia         numeric(12,2) not null default 0,
  notas              text,
  at                 timestamptz not null default now()
);

comment on table public.event_pos_closings is
  'POS de eventos: cortes de caja con arqueo. Solo se escriben con event_pos_record_closing.';

-- ---------------------------------------------------------------------------
-- Sello de quién y cuándo modificó configuración y lista de precios
-- ---------------------------------------------------------------------------

create or replace function public.event_pos_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(public.current_rep_id(), new.updated_by);
  if tg_table_name = 'event_pos_config' then
    if tg_op = 'INSERT' then
      new.created_by := coalesce(new.created_by, public.current_rep_id());
    end if;
    if new.status = 'cerrado' and (tg_op = 'INSERT' or old.status <> 'cerrado') then
      new.closed_at := now();
      new.closed_by := public.current_rep_id();
    elsif new.status <> 'cerrado' then
      new.closed_at := null;
      new.closed_by := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists event_pos_config_touch on public.event_pos_config;
create trigger event_pos_config_touch
  before insert or update on public.event_pos_config
  for each row execute function public.event_pos_touch();

drop trigger if exists event_pos_items_touch on public.event_pos_items;
create trigger event_pos_items_touch
  before insert or update on public.event_pos_items
  for each row execute function public.event_pos_touch();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.event_pos_config   enable row level security;
alter table public.event_pos_items    enable row level security;
alter table public.event_pos_sessions enable row level security;
alter table public.event_pos_sales    enable row level security;
alter table public.event_pos_closings enable row level security;

-- Configuración del evento
drop policy if exists event_pos_config_select on public.event_pos_config;
create policy event_pos_config_select on public.event_pos_config
  for select to authenticated using ((select public.event_pos_can_read()));

drop policy if exists event_pos_config_insert on public.event_pos_config;
create policy event_pos_config_insert on public.event_pos_config
  for insert to authenticated with check (public.event_pos_can_manage(event_id));

drop policy if exists event_pos_config_update on public.event_pos_config;
create policy event_pos_config_update on public.event_pos_config
  for update to authenticated
  using (public.event_pos_can_manage(event_id))
  with check (public.event_pos_can_manage(event_id));

drop policy if exists event_pos_config_delete on public.event_pos_config;
create policy event_pos_config_delete on public.event_pos_config
  for delete to authenticated
  using ((select public.is_admin())
         and not exists (select 1 from public.event_pos_sales s where s.event_id = event_pos_config.event_id));

-- Lista de precios / conciliación
drop policy if exists event_pos_items_select on public.event_pos_items;
create policy event_pos_items_select on public.event_pos_items
  for select to authenticated using ((select public.event_pos_can_read()));

drop policy if exists event_pos_items_insert on public.event_pos_items;
create policy event_pos_items_insert on public.event_pos_items
  for insert to authenticated with check (public.event_pos_can_manage(event_id));

drop policy if exists event_pos_items_update on public.event_pos_items;
create policy event_pos_items_update on public.event_pos_items
  for update to authenticated
  using (public.event_pos_can_manage(event_id))
  with check (public.event_pos_can_manage(event_id));

drop policy if exists event_pos_items_delete on public.event_pos_items;
create policy event_pos_items_delete on public.event_pos_items
  for delete to authenticated using (public.event_pos_can_manage(event_id));

-- Cajas, ventas y cortes: solo lectura directa. Escritura por RPC.
drop policy if exists event_pos_sessions_select on public.event_pos_sessions;
create policy event_pos_sessions_select on public.event_pos_sessions
  for select to authenticated using ((select public.event_pos_can_read()));

drop policy if exists event_pos_sales_select on public.event_pos_sales;
create policy event_pos_sales_select on public.event_pos_sales
  for select to authenticated using ((select public.event_pos_can_read()));

drop policy if exists event_pos_closings_select on public.event_pos_closings;
create policy event_pos_closings_select on public.event_pos_closings
  for select to authenticated using ((select public.event_pos_can_read()));

revoke all on public.event_pos_sessions, public.event_pos_sales, public.event_pos_closings from anon;
revoke insert, update, delete on public.event_pos_sessions, public.event_pos_sales, public.event_pos_closings from authenticated;
revoke all on public.event_pos_config, public.event_pos_items from anon;

-- ---------------------------------------------------------------------------
-- RPC: abrir caja
-- ---------------------------------------------------------------------------

create or replace function public.event_pos_open_session(
  p_event  uuid,
  p_caja   text,
  p_device text,
  p_fondo  numeric,
  p_force  boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_rep     public.sales_reps%rowtype;
  v_status  text;
  v_open    public.event_pos_sessions%rowtype;
  v_id      uuid;
  v_resumed boolean := false;
  v_seq     integer;
  v_fondo   numeric;
begin
  select * into v_rep from public.sales_reps
   where auth_user_id = auth.uid() and active = true and role in ('rep', 'admin')
   limit 1;
  if not found then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select status into v_status from public.event_pos_config where event_id = p_event;
  if not found then raise exception 'evento_sin_pos'; end if;
  if v_status <> 'abierto' then raise exception 'evento_no_abierto'; end if;
  if p_caja is null or p_caja !~ '^CAJA-[1-9]$' then raise exception 'caja_invalida'; end if;
  if coalesce(length(p_device), 0) < 8 then raise exception 'dispositivo_invalido'; end if;
  if p_fondo is null or p_fondo < 0 or p_fondo > 100000 then raise exception 'fondo_invalido'; end if;

  select * into v_open from public.event_pos_sessions
   where event_id = p_event and caja = p_caja and closed_at is null
   for update;

  if found then
    if v_open.device_id = p_device then
      v_id := v_open.id;          -- mismo dispositivo: se reanuda la caja
      v_resumed := true;
    elsif not coalesce(p_force, false) then
      raise exception 'caja_ocupada' using detail = v_open.seller_name;
    else
      update public.event_pos_sessions
         set closed_at = now(), closed_reason = 'liberada por ' || v_rep.full_name
       where id = v_open.id;
    end if;
  end if;

  if v_id is null then
    begin
      insert into public.event_pos_sessions (event_id, caja, device_id, seller_id, seller_name, fondo)
      values (p_event, p_caja, p_device, v_rep.id, v_rep.full_name, round(p_fondo, 2))
      returning id into v_id;
    exception when unique_violation then
      raise exception 'caja_ocupada';
    end;
  end if;

  select fondo into v_fondo from public.event_pos_sessions where id = v_id;

  select coalesce(max((substring(folio from '([0-9]+)$'))::integer), 0)
    into v_seq
    from public.event_pos_sales
   where event_id = p_event and caja = p_caja and folio ~ '[0-9]+$';

  return jsonb_build_object(
    'session_id', v_id,
    'resumed',    v_resumed,
    'fondo',      v_fondo,
    'last_seq',   v_seq
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: registrar venta (idempotente por id; nunca rechaza dinero ya cobrado
-- por reglas de negocio: lo marca "Revisar")
-- ---------------------------------------------------------------------------

create or replace function public.event_pos_record_sale(p_sale jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_rep       public.sales_reps%rowtype;
  v_seller    public.sales_reps%rowtype;
  v_cfg       public.event_pos_config%rowtype;
  v_id        text := p_sale->>'id';
  v_event     uuid;
  v_session   uuid;
  v_caja      text := p_sale->>'caja';
  v_folio     text := p_sale->>'folio';
  v_method    text := p_sale->>'method';
  v_at        timestamptz;
  v_lines     jsonb := p_sale->'lines';
  v_line      jsonb;
  v_qty       numeric;
  v_price     numeric;
  v_gross     numeric := 0;
  v_discount  numeric := coalesce((p_sale->>'discount')::numeric, 0);
  v_total     numeric := (p_sale->>'total')::numeric;
  v_notes     jsonb := '[]'::jsonb;
begin
  select * into v_rep from public.sales_reps
   where auth_user_id = auth.uid() and active = true and role in ('rep', 'admin')
   limit 1;
  if not found then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if v_id is null or length(v_id) not between 6 and 64 then
    raise exception 'venta_invalida: id';
  end if;

  if exists (select 1 from public.event_pos_sales where id = v_id) then
    return jsonb_build_object('status', 'duplicada');
  end if;

  v_event := (p_sale->>'event_id')::uuid;
  select * into v_cfg from public.event_pos_config where event_id = v_event;
  if not found then raise exception 'evento_sin_pos'; end if;

  if v_method is null or v_method not in ('Efectivo', 'Tarjeta', 'SPEI') then
    raise exception 'venta_invalida: método';
  end if;
  if v_total is null or v_total < 0 then raise exception 'venta_invalida: total'; end if;
  if v_folio is null or v_caja is null then raise exception 'venta_invalida: folio'; end if;
  if jsonb_typeof(v_lines) <> 'array' or jsonb_array_length(v_lines) = 0 then
    raise exception 'venta_invalida: renglones';
  end if;

  v_at := coalesce((p_sale->>'at')::timestamptz, now());
  if v_at > now() + interval '10 minutes' then
    v_notes := v_notes || to_jsonb('La hora del dispositivo está adelantada (' || v_at::text || ')');
  end if;

  if v_cfg.status <> 'abierto' then
    v_notes := v_notes || to_jsonb('Se registró con el POS del evento en estado "' || v_cfg.status || '"');
  end if;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_qty := (v_line->>'qty')::numeric;
    v_price := (v_line->>'price')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty <> trunc(v_qty) or v_price is null or v_price < 0 then
      raise exception 'venta_invalida: renglón %', v_line->>'sku';
    end if;
    v_gross := v_gross + v_qty * v_price;
    if not exists (
      select 1 from public.event_pos_items i
       where i.event_id = v_event and i.product_id::text = v_line->>'product_id'
    ) then
      v_notes := v_notes || to_jsonb(coalesce(v_line->>'sku', 'Producto') || ': no está en la lista del evento');
    elsif exists (
      select 1 from public.event_pos_items i
       where i.event_id = v_event and i.product_id::text = v_line->>'product_id'
         and abs(i.precio - v_price) > 0.005
    ) then
      v_notes := v_notes || to_jsonb(coalesce(v_line->>'sku', 'Producto') || ': precio distinto al de la lista');
    end if;
  end loop;

  if abs((v_gross - v_discount) - v_total) > 0.05 then
    v_notes := v_notes || to_jsonb('El total no cuadra con los renglones (' || round(v_gross - v_discount, 2) || ' vs ' || v_total || ')');
  end if;

  if v_gross > 0 and v_discount > 0
     and (v_discount / v_gross) * 100 > v_cfg.descuento_max_pct + 0.01 then
    v_notes := v_notes || to_jsonb('Descuento de ' || round(v_discount / v_gross * 100, 1) || '% arriba del máximo (' || v_cfg.descuento_max_pct || '%)');
  end if;

  if v_method = 'Efectivo' and coalesce((p_sale->>'received')::numeric, v_total) + 0.005 < v_total then
    v_notes := v_notes || to_jsonb('Efectivo recibido menor al total'::text);
  end if;

  v_session := nullif(p_sale->>'session_id', '')::uuid;
  if v_session is null or not exists (
    select 1 from public.event_pos_sessions s
     where s.id = v_session and s.event_id = v_event and s.caja = v_caja
  ) then
    v_notes := v_notes || to_jsonb('Caja sin sesión válida'::text);
    v_session := null;
  end if;

  if exists (select 1 from public.event_pos_sales where event_id = v_event and folio = v_folio) then
    v_notes := v_notes || to_jsonb('Folio repetido: ' || v_folio);
  end if;

  -- Quién vendió: el vendedor declarado en el dispositivo si es válido
  -- (la venta pudo cobrarse sin internet y subirse en otro turno).
  select * into v_seller from public.sales_reps
   where id = nullif(p_sale->'seller'->>'id', '')::uuid and active = true and role in ('rep', 'admin');
  if not found then
    v_seller := v_rep;
  end if;

  insert into public.event_pos_sales (
    id, event_id, session_id, folio, caja, at, seller_id, seller_name, customer, lines,
    subtotal, discount, discount_pct, iva, total, method, received, change, card_ref,
    needs_review, review_notes, recorded_by
  ) values (
    v_id, v_event, v_session, v_folio, v_caja, v_at, v_seller.id, v_seller.full_name,
    case when jsonb_typeof(p_sale->'customer') = 'object' then p_sale->'customer' end,
    v_lines,
    round(v_gross, 2), round(v_discount, 2), nullif(p_sale->>'discount_pct', '')::numeric,
    round(v_total - v_total / 1.16, 2), round(v_total, 2), v_method,
    nullif(p_sale->>'received', '')::numeric, nullif(p_sale->>'change', '')::numeric,
    nullif(left(p_sale->>'card_ref', 40), ''),
    jsonb_array_length(v_notes) > 0, v_notes, auth.uid()
  )
  on conflict (id) do nothing;

  return jsonb_build_object('status', 'ok', 'notes', v_notes);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: corte de caja (idempotente por client_id). Cierra la caja.
-- ---------------------------------------------------------------------------

create or replace function public.event_pos_record_closing(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_rep     public.sales_reps%rowtype;
  v_seller  public.sales_reps%rowtype;
  v_event   uuid := (p->>'event_id')::uuid;
  v_session uuid := nullif(p->>'session_id', '')::uuid;
  v_client  text := p->>'client_id';
  v_id      uuid;
begin
  select * into v_rep from public.sales_reps
   where auth_user_id = auth.uid() and active = true and role in ('rep', 'admin')
   limit 1;
  if not found then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if v_client is null or length(v_client) < 6 then raise exception 'corte_invalido'; end if;

  select id into v_id from public.event_pos_closings where client_id = v_client;
  if found then
    return jsonb_build_object('status', 'duplicado', 'id', v_id);
  end if;

  if not exists (select 1 from public.event_pos_config where event_id = v_event) then
    raise exception 'evento_sin_pos';
  end if;

  if v_session is not null and not exists (
    select 1 from public.event_pos_sessions where id = v_session and event_id = v_event
  ) then
    v_session := null;
  end if;

  select * into v_seller from public.sales_reps
   where id = nullif(p->'seller'->>'id', '')::uuid and active = true;
  if not found then v_seller := v_rep; end if;

  insert into public.event_pos_closings (
    client_id, event_id, session_id, caja, seller_id, seller_name, fondo, tickets, total,
    efectivo, tarjeta, spei, efectivo_esperado, efectivo_contado, diferencia, notas, at
  ) values (
    v_client, v_event, v_session, coalesce(p->>'caja', '—'), v_seller.id, v_seller.full_name,
    coalesce((p->>'fondo')::numeric, 0), coalesce((p->>'tickets')::integer, 0),
    coalesce((p->>'total')::numeric, 0), coalesce((p->>'efectivo')::numeric, 0),
    coalesce((p->>'tarjeta')::numeric, 0), coalesce((p->>'spei')::numeric, 0),
    coalesce((p->>'efectivo_esperado')::numeric, 0), coalesce((p->>'efectivo_contado')::numeric, 0),
    coalesce((p->>'diferencia')::numeric, 0), nullif(left(p->>'notas', 500), ''),
    coalesce((p->>'at')::timestamptz, now())
  )
  returning id into v_id;

  if v_session is not null then
    update public.event_pos_sessions
       set closed_at = coalesce(closed_at, now()),
           closed_reason = coalesce(closed_reason, 'corte de caja')
     where id = v_session;
  end if;

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: anular venta (admin o coordinador del evento; con motivo)
-- ---------------------------------------------------------------------------

create or replace function public.event_pos_void_sale(p_id text, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_event  uuid;
  v_voided timestamptz;
begin
  select event_id, voided_at into v_event, v_voided
    from public.event_pos_sales where id = p_id for update;
  if not found then raise exception 'venta_no_encontrada'; end if;
  if not public.event_pos_can_manage(v_event) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;
  if v_voided is not null then raise exception 'venta_ya_anulada'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'motivo_requerido'; end if;

  update public.event_pos_sales
     set voided_at = now(), voided_by = public.current_rep_id(), void_reason = left(trim(p_reason), 300)
   where id = p_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.event_pos_can_read() from public, anon;
revoke execute on function public.event_pos_can_manage(uuid) from public, anon;
revoke execute on function public.event_pos_open_session(uuid, text, text, numeric, boolean) from public, anon;
revoke execute on function public.event_pos_record_sale(jsonb) from public, anon;
revoke execute on function public.event_pos_record_closing(jsonb) from public, anon;
revoke execute on function public.event_pos_void_sale(text, text) from public, anon;

grant execute on function public.event_pos_can_read() to authenticated;
grant execute on function public.event_pos_can_manage(uuid) to authenticated;
grant execute on function public.event_pos_open_session(uuid, text, text, numeric, boolean) to authenticated;
grant execute on function public.event_pos_record_sale(jsonb) to authenticated;
grant execute on function public.event_pos_record_closing(jsonb) to authenticated;
grant execute on function public.event_pos_void_sale(text, text) to authenticated;

commit;
