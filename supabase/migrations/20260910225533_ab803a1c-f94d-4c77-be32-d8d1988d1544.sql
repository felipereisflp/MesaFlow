-- ENUMS
CREATE TYPE public.app_role AS ENUM ('owner','admin','gerente','caixa','garcom','cozinha','bar','auditor');
CREATE TYPE public.station AS ENUM ('cozinha','bar');

-- TENANTS
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  tax_id text,
  logo_url text,
  brand_color text NOT NULL DEFAULT '#1d4ed8',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  currency text NOT NULL DEFAULT 'BRL',
  service_fee_pct numeric(5,2) NOT NULL DEFAULT 10,
  service_fee_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'OPERATIONAL' CHECK (status IN ('OPERATIONAL','SUSPENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  full_name text NOT NULL DEFAULT '',
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- POLICIES for base tables
CREATE POLICY "Tenants: membros leem" ON public.tenants FOR SELECT TO authenticated USING (id = public.current_tenant_id());
CREATE POLICY "Tenants: qualquer autenticado cria" ON public.tenants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Tenants: dono/admin edita" ON public.tenants FOR UPDATE TO authenticated
  USING (id = public.current_tenant_id() AND public.has_any_role(ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (id = public.current_tenant_id());

CREATE POLICY "Perfil proprio" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR tenant_id = public.current_tenant_id());
CREATE POLICY "Perfil proprio insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Perfil proprio update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR (tenant_id = public.current_tenant_id() AND public.has_any_role(ARRAY['owner','admin']::public.app_role[]))) WITH CHECK (true);

CREATE POLICY "Papeis do tenant" ON public.user_roles FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() OR user_id = auth.uid());

CREATE TRIGGER t_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CATALOG
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  image_url text,
  station public.station NOT NULL DEFAULT 'cozinha',
  available boolean NOT NULL DEFAULT true,
  archived boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABLES / NFC
CREATE TABLE public.venue_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_code text NOT NULL,
  area text,
  seats int NOT NULL DEFAULT 4,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, display_code)
);
CREATE TABLE public.nfc_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.venue_tables(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  token_version int NOT NULL DEFAULT 1,
  label text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SESSIONS / ORDERS
CREATE TABLE public.dining_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.venue_tables(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ORDERING','PAYMENT_PENDING','PARTIALLY_PAID','PAID','CLOSED','CANCELLED')),
  version int NOT NULL DEFAULT 1,
  items_total numeric(10,2) NOT NULL DEFAULT 0,
  service_fee numeric(10,2) NOT NULL DEFAULT 0,
  discount_total numeric(10,2) NOT NULL DEFAULT 0,
  paid_total numeric(10,2) NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_active_session_per_table ON public.dining_sessions (table_id)
  WHERE status IN ('OPEN','ORDERING','PAYMENT_PENDING','PARTIALLY_PAID');

CREATE TABLE public.customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dining_session_id uuid NOT NULL REFERENCES public.dining_sessions(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '6 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dining_session_id uuid NOT NULL REFERENCES public.dining_sessions(id) ON DELETE CASCADE,
  origin text NOT NULL DEFAULT 'CLIENTE' CHECK (origin IN ('CLIENTE','EQUIPE')),
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','CONFIRMED','IN_PREPARATION','READY','DELIVERED','CANCELLED')),
  idempotency_key text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  dining_session_id uuid NOT NULL REFERENCES public.dining_sessions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  unit_price_snapshot numeric(10,2) NOT NULL,
  modifiers_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  note text,
  station public.station NOT NULL,
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','CONFIRMED','IN_PREPARATION','READY','DELIVERED','CANCELLED')),
  cancel_reason text,
  charged boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dining_session_id uuid NOT NULL REFERENCES public.dining_sessions(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','OUTRO')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING','CONFIRMED','REFUNDED')),
  source text NOT NULL DEFAULT 'CAIXA_MANUAL',
  registered_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AUDIT
CREATE TABLE public.audit_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_type text NOT NULL DEFAULT 'USER',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  previous_state_summary jsonb,
  new_state_summary jsonb,
  reason text,
  result text NOT NULL DEFAULT 'SUCCESS',
  prev_hash text,
  curr_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTS + RLS for tenant-scoped tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','modifiers','venue_tables','nfc_tags','dining_sessions','orders','order_items','payments','audit_events','security_events','customer_sessions']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "membros do tenant leem" ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());', t);
  END LOOP;
END $$;

-- write policies
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','modifiers','venue_tables','nfc_tags']
  LOOP
    EXECUTE format('CREATE POLICY "gestao escreve" ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_any_role(ARRAY[''owner'',''admin'',''gerente'']::public.app_role[]));', t);
    EXECUTE format('CREATE POLICY "gestao atualiza" ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_any_role(ARRAY[''owner'',''admin'',''gerente'']::public.app_role[])) WITH CHECK (tenant_id = public.current_tenant_id());', t);
    EXECUTE format('CREATE POLICY "gestao remove" ON public.%I FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_any_role(ARRAY[''owner'',''admin'']::public.app_role[]));', t);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dining_sessions','orders','order_items','payments']
  LOOP
    EXECUTE format('CREATE POLICY "equipe escreve" ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());', t);
    EXECUTE format('CREATE POLICY "equipe atualiza" ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());', t);
  END LOOP;
END $$;

CREATE TRIGGER t_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_venue_tables_updated BEFORE UPDATE ON public.venue_tables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_nfc_tags_updated BEFORE UPDATE ON public.nfc_tags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_sessions_updated BEFORE UPDATE ON public.dining_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_order_items_updated BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.dining_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dining_sessions;