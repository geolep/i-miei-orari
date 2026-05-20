-- =====================================================
-- Shop settings: schedule versionati + chiusure straordinarie
--
-- Modello:
--   * shop_schedule_periods : "periodi" con un nome e un intervallo di
--                             validità (es. "Orario estivo" 1 mag – 30 set).
--     valid_to NULL = periodo aperto/in corso (es. "Orario invernale dal 1 ott").
--   * shop_schedule_hours   : una riga per (periodo, weekday). Per ogni giorno
--                             si imposta apertura/chiusura e due fasce (pausa).
--   * shop_closures         : chiusure straordinarie puntuali (festività, ferie).
--
-- Lo schedule "attivo oggi" è il periodo con la valid_from più recente che
-- contiene la data corrente.
-- =====================================================

create table if not exists public.shop_schedule_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  valid_from date not null,
  valid_to date,                       -- NULL = ancora in corso
  notes text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  check (valid_to is null or valid_to >= valid_from)
);

create index if not exists shop_schedule_periods_valid_from_idx
  on public.shop_schedule_periods (valid_from desc);

create table if not exists public.shop_schedule_hours (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.shop_schedule_periods(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_closed boolean not null default false,
  open_time_1 time,
  close_time_1 time,
  open_time_2 time,
  close_time_2 time,
  unique (period_id, weekday)
);

create table if not exists public.shop_closures (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  check (end_date >= start_date)
);

create index if not exists shop_closures_start_date_idx
  on public.shop_closures (start_date);

-- =====================================================
-- Seed: un periodo di default "Orario standard" attivo da oggi
--       (lun-sab 09:00-19:30, domenica chiusa).
-- =====================================================
do $$
declare
  v_period_id uuid;
begin
  if not exists (select 1 from public.shop_schedule_periods) then
    insert into public.shop_schedule_periods (name, valid_from, valid_to, notes)
    values ('Orario standard', current_date, null, 'Periodo iniziale generato automaticamente')
    returning id into v_period_id;

    insert into public.shop_schedule_hours (period_id, weekday, is_closed, open_time_1, close_time_1)
    values
      (v_period_id, 0, true,  null,    null),
      (v_period_id, 1, false, '09:00', '19:30'),
      (v_period_id, 2, false, '09:00', '19:30'),
      (v_period_id, 3, false, '09:00', '19:30'),
      (v_period_id, 4, false, '09:00', '19:30'),
      (v_period_id, 5, false, '09:00', '19:30'),
      (v_period_id, 6, false, '09:00', '19:30');
  end if;
end $$;

-- =====================================================
-- View comoda: lo schedule attivo a una certa data.
-- Uso: select * from shop_schedule_for_date('2026-07-15');
-- =====================================================
create or replace function public.shop_schedule_for_date(p_date date)
returns table (
  period_id uuid,
  period_name text,
  weekday smallint,
  is_closed boolean,
  open_time_1 time,
  close_time_1 time,
  open_time_2 time,
  close_time_2 time
)
language sql stable as $$
  with active as (
    select p.id, p.name
    from public.shop_schedule_periods p
    where p.valid_from <= p_date
      and (p.valid_to is null or p.valid_to >= p_date)
    order by p.valid_from desc
    limit 1
  )
  select a.id, a.name, h.weekday, h.is_closed,
         h.open_time_1, h.close_time_1, h.open_time_2, h.close_time_2
  from active a
  join public.shop_schedule_hours h on h.period_id = a.id
  order by h.weekday;
$$;

-- =====================================================
-- Row Level Security
-- =====================================================
alter table public.shop_schedule_periods enable row level security;
alter table public.shop_schedule_hours   enable row level security;
alter table public.shop_closures         enable row level security;

-- Lettura aperta a tutti gli utenti autenticati
create policy "shop_schedule_periods read for authenticated"
  on public.shop_schedule_periods for select to authenticated using (true);

create policy "shop_schedule_hours read for authenticated"
  on public.shop_schedule_hours for select to authenticated using (true);

create policy "shop_closures read for authenticated"
  on public.shop_closures for select to authenticated using (true);

-- Scrittura solo per admin/manager
create policy "shop_schedule_periods write for admin/manager"
  on public.shop_schedule_periods for all to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.email = auth.email() and e.role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.employees e
      where e.email = auth.email() and e.role in ('admin', 'manager')
    )
  );

create policy "shop_schedule_hours write for admin/manager"
  on public.shop_schedule_hours for all to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.email = auth.email() and e.role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.employees e
      where e.email = auth.email() and e.role in ('admin', 'manager')
    )
  );

create policy "shop_closures write for admin/manager"
  on public.shop_closures for all to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.email = auth.email() and e.role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.employees e
      where e.email = auth.email() and e.role in ('admin', 'manager')
    )
  );
