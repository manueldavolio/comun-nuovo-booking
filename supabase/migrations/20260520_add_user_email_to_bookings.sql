-- Esegui in Supabase SQL Editor se la colonna non esiste già.
-- Non rimuove user_phone: le prenotazioni esistenti restano invariate.

alter table public.bookings
  add column if not exists user_email text;

comment on column public.bookings.user_email is 'Email cliente per conferme e comunicazioni';
