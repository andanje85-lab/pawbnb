create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  breed text,
  size text default 'medium' check (size in ('small','medium','large')),
  gender text check (gender in ('male','female')),
  date_of_birth date,
  spayed_neutered boolean not null default false,
  vaccination_status text not null default 'not_vaccinated' check (vaccination_status in ('up_to_date','partial','not_vaccinated')),
  vaccination_notes text,
  temperament text,
  medical_conditions text,
  care_notes text,
  feeding_instructions text,
  vet_name text,
  vet_phone text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_dogs (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (booking_id, dog_id)
);

alter table public.dogs enable row level security;
alter table public.booking_dogs enable row level security;

-- Owner full control over their own dogs
create policy "dogs_owner_all" on public.dogs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Hosts can read dog profiles attached to bookings on their listings
create policy "dogs_host_read" on public.dogs
  for select using (
    exists (
      select 1 from public.booking_dogs bd
      join public.bookings b on b.id = bd.booking_id
      join public.listings l on l.id = b.listing_id
      where bd.dog_id = dogs.id and l.host_id = auth.uid()
    )
  );

-- Guests manage the dogs attached to their own bookings
create policy "booking_dogs_guest_all" on public.booking_dogs
  for all using (
    exists (select 1 from public.bookings b where b.id = booking_id and b.guest_id = auth.uid())
  ) with check (
    exists (select 1 from public.bookings b where b.id = booking_id and b.guest_id = auth.uid())
  );

-- Hosts can read which dogs are booked on their listings
create policy "booking_dogs_host_read" on public.booking_dogs
  for select using (
    exists (
      select 1 from public.bookings b
      join public.listings l on l.id = b.listing_id
      where b.id = booking_id and l.host_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.dogs to authenticated;
grant select, insert, update, delete on public.booking_dogs to authenticated;

create trigger set_dogs_updated_at before update on public.dogs
  for each row execute function public.update_updated_at_column();

create index dogs_owner_idx on public.dogs (owner_id);
create index booking_dogs_dog_idx on public.booking_dogs (dog_id);