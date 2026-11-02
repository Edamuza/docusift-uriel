CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','needs_review','approved','failed')),
  extracted jsonb,
  data jsonb,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_fields text[] NOT NULL DEFAULT '{}',
  processing_ms integer,
  error text,
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
GRANT SELECT ON public.documents TO anon, authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo documents are publicly readable" ON public.documents FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_approve boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are publicly readable" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.reset_demo()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  c jsonb := '{"document_type":0.97,"vendor_name":0.96,"vendor_tin":0.95,"vendor_address":0.93,"buyer_name":0.94,"invoice_number":0.97,"invoice_date":0.95,"currency":0.99,"vatable_sales":0.96,"vat_amount":0.96,"vat_exempt_sales":0.94,"total_amount":0.97,"line_items":0.93}';
  s1 jsonb := '{"document_type":"Sales Invoice","vendor_name":"Sari-Sari Supplies Trading (fictional)","vendor_tin":"123-456-789-00000","vendor_address":"123 Rizal Avenue, Sta. Cruz, Manila","buyer_name":"Dela Cruz Accounting Services (fictional)","invoice_number":"0001245","invoice_date":"2026-10-14","currency":"PHP","vatable_sales":4520,"vat_amount":542.4,"vat_exempt_sales":0,"total_amount":5062.4,"line_items":[{"description":"Bond paper A4, ream","quantity":10,"unit_price":250,"amount":2500},{"description":"Ballpens, box of 12","quantity":5,"unit_price":120,"amount":600},{"description":"Folders, long, pack of 10","quantity":4,"unit_price":95,"amount":380},{"description":"Printer ink, black","quantity":2,"unit_price":520,"amount":1040}]}';
  s2 jsonb := '{"document_type":"Official Receipt","vendor_name":"Kusina ni Lola Catering (fictional)","vendor_tin":"234-567-890-000","vendor_address":"45 Mabini Street, Malolos, Bulacan","buyer_name":"Barangay San Isidro Council (fictional)","invoice_number":"004512","invoice_date":"2026-10-20","currency":"PHP","vatable_sales":0,"vat_amount":0,"vat_exempt_sales":5300,"total_amount":5300,"line_items":[{"description":"Pancit party tray","quantity":3,"unit_price":1200,"amount":3600},{"description":"Kakanin bilao","quantity":2,"unit_price":850,"amount":1700}]}';
  s3 jsonb := '{"document_type":"Sales Invoice","vendor_name":"Mabilis Hardware (fictional)","vendor_tin":"345-678-901-0000","vendor_address":"88 Quezon Boulevard, Quezon City","buyer_name":"Reyes Construction (fictional)","invoice_number":"0007781","invoice_date":"2026-10-25","currency":"PHP","vatable_sales":9910,"vat_amount":1189.2,"vat_exempt_sales":0,"total_amount":11199.2,"line_items":[{"description":"Portland cement, 40kg bag","quantity":10,"unit_price":265,"amount":2650},{"description":"Rebar 10mm x 6m","quantity":20,"unit_price":185,"amount":3700},{"description":"Marine plywood 1/2in","quantity":5,"unit_price":640,"amount":3200},{"description":"Common nails, kg","quantity":4,"unit_price":90,"amount":360}]}';
  s4 jsonb := '{"document_type":"Sales Invoice","vendor_name":"Bayanihan Office Depot (fictional)","vendor_tin":"456-789-012-00000","vendor_address":"12 Colon Street, Cebu City","buyer_name":"Santos Dental Clinic (fictional)","invoice_number":"0003310","invoice_date":"2026-09-30","currency":"PHP","vatable_sales":1610,"vat_amount":193.2,"vat_exempt_sales":0,"total_amount":1803.2,"line_items":[{"description":"Heavy-duty stapler","quantity":3,"unit_price":350,"amount":1050},{"description":"Whiteboard markers, box","quantity":2,"unit_price":280,"amount":560}]}';
BEGIN
  DELETE FROM public.documents WHERE true;
  INSERT INTO public.app_settings (id, auto_approve) VALUES (1, false)
    ON CONFLICT (id) DO UPDATE SET auto_approve = false;
  INSERT INTO public.documents (id, file_name, image_url, status, extracted, data, confidence, changed_fields, processing_ms, is_seed, created_at, approved_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'sari-sari-supplies.png', '/samples/sari-sari-supplies.svg', 'approved', s1, s1, c, '{}', 6820, true, '2026-10-28 09:12+00', '2026-10-28 09:20+00'),
  ('00000000-0000-4000-8000-000000000002', 'kusina-ni-lola.png', '/samples/kusina-ni-lola.svg', 'approved', s2 || '{"vendor_address":"45 Mabini St, Malolos"}', s2, c || '{"vendor_address":0.81}', '{vendor_address}', 7410, true, '2026-10-29 03:40+00', '2026-10-29 03:52+00'),
  ('00000000-0000-4000-8000-000000000003', 'bayanihan-office-depot.png', '/samples/bayanihan-office-depot.svg', 'approved', s4 || '{"buyer_name":"Santos Dental Clinic","invoice_date":"2026-09-03"}', s4, c || '{"buyer_name":0.86,"invoice_date":0.72}', '{buyer_name,invoice_date}', 8130, true, '2026-10-30 06:05+00', '2026-10-30 06:15+00'),
  ('00000000-0000-4000-8000-000000000004', 'mabilis-hardware.png', '/samples/mabilis-hardware.svg', 'needs_review', s3, s3, c, '{}', 7050, true, '2026-11-01 02:30+00', NULL);
END;
$fn$;
REVOKE ALL ON FUNCTION public.reset_demo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo() TO service_role;

SELECT public.reset_demo();