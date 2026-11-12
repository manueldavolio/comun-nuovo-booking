-- Apply only AFTER the application uses its server-only service role and signed admin sessions.
-- No existing reservation or tariff is changed.
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bookings, public.admin_blocks, public.blocks, public.resources, public.customers, public.subscriptions FROM anon, authenticated;
GRANT ALL ON public.bookings, public.admin_blocks, public.blocks, public.resources, public.customers, public.subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.guard_booking_admin_block() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    IF NEW.status NOT IN ('PENDING_PAYMENT','CONFIRMED') THEN RETURN NEW; END IF;
  END IF;
  IF NEW.end_ts <= NEW.start_ts THEN RAISE EXCEPTION 'Intervallo non valido' USING ERRCODE='23P01'; END IF;
  -- Every calendar writer locks the same resource before testing the other table.
  PERFORM id FROM public.resources WHERE id=NEW.resource_id FOR UPDATE;
  IF TG_TABLE_NAME='bookings' THEN
    IF EXISTS (SELECT 1 FROM public.admin_blocks b WHERE b.resource_id=NEW.resource_id AND b.start_ts<NEW.end_ts AND b.end_ts>NEW.start_ts) THEN
      RAISE EXCEPTION 'Campo bloccato dal centro' USING ERRCODE='23P01';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.resource_id=NEW.resource_id AND b.status IN ('PENDING_PAYMENT','CONFIRMED') AND b.start_ts<NEW.end_ts AND b.end_ts>NEW.start_ts) THEN
      RAISE EXCEPTION 'Campo già prenotato' USING ERRCODE='23P01';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_booking_admin_block() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_booking_admin_block() TO service_role;
CREATE TRIGGER booking_admin_block_guard BEFORE INSERT OR UPDATE OF resource_id,start_ts,end_ts,status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_booking_admin_block();
CREATE TRIGGER admin_block_booking_guard BEFORE INSERT OR UPDATE OF resource_id,start_ts,end_ts ON public.admin_blocks FOR EACH ROW EXECUTE FUNCTION public.guard_booking_admin_block();
