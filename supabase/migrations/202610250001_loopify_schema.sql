create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  organization text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null,
  description text not null default '',
  condition text not null default 'Good'
    check (condition in ('Excellent', 'Good', 'Needs repair', 'Under review')),
  storage_location text not null default '',
  owner_organization text not null,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  borrower_id uuid not null references auth.users(id) on delete restrict,
  borrower_organization text not null,
  event_name text not null,
  start_date date not null,
  due_date date not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'on-loan', 'returned', 'needs-repair', 'cancelled')),
  reserved_at timestamptz not null default now(),
  handed_over_at timestamptz,
  returned_at timestamptz,
  return_condition text
    check (return_condition is null or return_condition in ('Excellent', 'Good', 'Needs repair', 'Under review')),
  used_at_event boolean,
  reported_alternative text
    check (reported_alternative is null or reported_alternative in ('new-purchase', 'borrowed', 'owned', 'changed-plan', 'unsure', 'not-answered')),
  note text,
  constraint transaction_dates_valid check (due_date >= start_date)
);

create index if not exists transactions_item_dates_idx
  on public.transactions (item_id, start_date, due_date)
  where status in ('reserved', 'on-loan');

create index if not exists transactions_borrower_idx
  on public.transactions (borrower_id, reserved_at desc);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, organization)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'organization', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_loopify on auth.users;
create trigger on_auth_user_created_loopify
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.transactions enable row level security;

revoke all on public.profiles, public.items, public.transactions from anon;
grant select on public.profiles to authenticated;
grant update (display_name, organization) on public.profiles to authenticated;
grant select, insert, update on public.items to authenticated;
grant select on public.transactions to authenticated;

drop policy if exists "Members can read profiles" on public.profiles;
create policy "Members can read profiles"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Members can read inventory" on public.items;
create policy "Members can read inventory"
  on public.items for select to authenticated using (true);

drop policy if exists "Members can add their own inventory" on public.items;
create policy "Members can add their own inventory"
  on public.items for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can update their inventory" on public.items;
create policy "Owners can update their inventory"
  on public.items for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Members can read campus transactions" on public.transactions;
create policy "Members can read campus transactions"
  on public.transactions for select to authenticated using (true);

revoke insert, update, delete on public.transactions from anon, authenticated;

create or replace function public.reserve_item(
  p_item_id uuid,
  p_borrower_organization text,
  p_event_name text,
  p_start_date date,
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.items%rowtype;
  v_allocated integer;
  v_transaction_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before making a reservation.';
  end if;
  if p_due_date < p_start_date then
    raise exception 'The return date must be on or after the event date.';
  end if;

  select * into v_item
    from public.items
    where id = p_item_id
    for update;

  if not found then
    raise exception 'This material is no longer available.';
  end if;
  if v_item.condition not in ('Excellent', 'Good') then
    raise exception 'This material needs a condition check before it can be reserved.';
  end if;

  select count(*) into v_allocated
    from public.transactions
    where item_id = p_item_id
      and status in ('reserved', 'on-loan')
      and daterange(start_date, due_date, '[]') && daterange(p_start_date, p_due_date, '[]');

  if v_allocated >= v_item.quantity then
    raise exception 'This material is already reserved for some or all of those dates.';
  end if;

  insert into public.transactions (
    item_id, borrower_id, borrower_organization, event_name, start_date, due_date
  ) values (
    p_item_id, (select auth.uid()), trim(p_borrower_organization),
    trim(p_event_name), p_start_date, p_due_date
  ) returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function public.confirm_handover(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.transactions t
    set status = 'on-loan', handed_over_at = now()
    where t.id = p_transaction_id
      and t.status = 'reserved'
      and (
        t.borrower_id = (select auth.uid())
        or exists (
          select 1 from public.items i
          where i.id = t.item_id and i.owner_id = (select auth.uid())
        )
      );
  if not found then
    raise exception 'This reservation cannot be handed over or you do not have permission.';
  end if;
end;
$$;

create or replace function public.cancel_reservation(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.transactions t
    set status = 'cancelled'
    where t.id = p_transaction_id
      and t.status = 'reserved'
      and t.borrower_id = (select auth.uid());
  if not found then
    raise exception 'This reservation can no longer be cancelled or you do not have permission.';
  end if;
end;
$$;

create or replace function public.record_return(
  p_transaction_id uuid,
  p_return_condition text,
  p_used_at_event boolean,
  p_reported_alternative text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id uuid;
begin
  if p_return_condition not in ('Excellent', 'Good', 'Needs repair', 'Under review') then
    raise exception 'Choose a valid return condition.';
  end if;
  if p_reported_alternative not in ('new-purchase', 'borrowed', 'owned', 'changed-plan', 'unsure', 'not-answered') then
    raise exception 'Choose a valid reported alternative.';
  end if;

  update public.transactions t
    set status = case
          when p_return_condition in ('Needs repair', 'Under review') then 'needs-repair'
          else 'returned'
        end,
        returned_at = now(),
        return_condition = p_return_condition,
        used_at_event = p_used_at_event,
        reported_alternative = p_reported_alternative,
        note = nullif(trim(coalesce(p_note, '')), '')
    where t.id = p_transaction_id
      and t.status = 'on-loan'
      and (
        t.borrower_id = (select auth.uid())
        or exists (
          select 1 from public.items i
          where i.id = t.item_id and i.owner_id = (select auth.uid())
        )
      )
    returning t.item_id into v_item_id;

  if not found then
    raise exception 'This loan cannot be returned or you do not have permission.';
  end if;

  update public.items
    set condition = p_return_condition, updated_at = now()
    where id = v_item_id;
end;
$$;

revoke execute on function public.reserve_item(uuid, text, text, date, date) from public, anon;
revoke execute on function public.confirm_handover(uuid) from public, anon;
revoke execute on function public.cancel_reservation(uuid) from public, anon;
revoke execute on function public.record_return(uuid, text, boolean, text, text) from public, anon;
grant execute on function public.reserve_item(uuid, text, text, date, date) to authenticated;
grant execute on function public.confirm_handover(uuid) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;
grant execute on function public.record_return(uuid, text, boolean, text, text) to authenticated;
