-- Idempotent dev/test seed: facilities (Amazon warehouse, CNA nursing home, etc.), shifts, and sample assignments.
-- Scoped to tenant 8e13d397-263b-424a-8348-490c900550c0 when present.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = '8e13d397-263b-424a-8348-490c900550c0'::uuid
  ) THEN
    RAISE NOTICE 'Skipping test facility seed: tenant not found';
    RETURN;
  END IF;

  INSERT INTO public.clients (
    id, tenant_id, user_id, company_name, address, city, state, zip_code,
    verification_status, onboarding_status
  ) VALUES (
    'a1111111-1111-4111-8111-111111111111',
    '8e13d397-263b-424a-8348-490c900550c0',
    '49ea6d99-dbf8-4472-9e5d-de16822721be',
    'Nexus Test Staffing Client',
    '100 Test Commerce Blvd',
    'Detroit',
    'MI',
    '48226',
    'verified',
    'completed'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.job_categories (id, tenant_id, name, active) VALUES
    ('c1111111-1111-4111-8111-111111111101', '8e13d397-263b-424a-8348-490c900550c0', 'CNA', true),
    ('c1111111-1111-4111-8111-111111111102', '8e13d397-263b-424a-8348-490c900550c0', 'Warehouse Associate', true),
    ('c1111111-1111-4111-8111-111111111103', '8e13d397-263b-424a-8348-490c900550c0', 'Registered Nurse (RN)', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facility (
    id, tenant_id, client_id, name, address, phone, about, is_headquarters
  ) VALUES
    (
      'f1111111-1111-4111-8111-111111111101',
      '8e13d397-263b-424a-8348-490c900550c0',
      'a1111111-1111-4111-8111-111111111111',
      'Amazon DTW1 Fulfillment Center',
      '39000 Amrhein Rd, Livonia, MI 48150',
      '(800) 555-0199',
      'Warehouse picking and packing — test facility',
      false
    ),
    (
      'f1111111-1111-4111-8111-111111111102',
      '8e13d397-263b-424a-8348-490c900550c0',
      'a1111111-1111-4111-8111-111111111111',
      'Sunrise Skilled Nursing (CNA)',
      '2200 Wellness Dr, Troy, MI 48084',
      '(248) 555-0142',
      'Long-term care — CNA shifts',
      false
    ),
    (
      'f1111111-1111-4111-8111-111111111103',
      '8e13d397-263b-424a-8348-490c900550c0',
      'a1111111-1111-4111-8111-111111111111',
      'Costco Wholesale Distribution',
      '11525 Stephens Rd, Warren, MI 48089',
      '(586) 555-0177',
      'Distribution and receiving',
      false
    ),
    (
      'f1111111-1111-4111-8111-111111111104',
      '8e13d397-263b-424a-8348-490c900550c0',
      'a1111111-1111-4111-8111-111111111111',
      'Mercy Hospital — Med-Surg Unit',
      '36475 Five Mile Rd, Livonia, MI 48154',
      '(734) 555-0101',
      'Acute care med-surg',
      true
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.shifts (
    id, tenant_id, client_id, facility_id, job_category_id, title, description,
    start_date, end_date, number_of_people_needed, rate_per_hour, escrow_paid
  ) VALUES
    (
      'b1111111-1111-4111-8111-111111111101',
      '8e13d397-263b-424a-8348-490c900550c0',
      'a1111111-1111-4111-8111-111111111111',
      'f1111111-1111-4111-8111-111111111101',
      'c1111111-1111-4111-8111-111111111102',
      'Warehouse Associate — Day Shift',
      'Amazon warehouse floor support (test)',
      CURRENT_DATE,
      CURRENT_DATE + 90,
      5,
      22.50,
      false
    ),
    (
      'b1111111-1111-4111-8111-111111111102',
      '8e13d397-263b-424a-8348-490c900550c0',
      'a1111111-1111-4111-8111-111111111111',
      'f1111111-1111-4111-8111-111111111102',
      'c1111111-1111-4111-8111-111111111101',
      'CNA — Evening Shift',
      'Skilled nursing CNA coverage (test)',
      CURRENT_DATE,
      CURRENT_DATE + 60,
      3,
      28.00,
      false
    ),
    (
      'b1111111-1111-4111-8111-111111111103',
      '8e13d397-263b-424a-8348-490c900550c0',
      'a1111111-1111-4111-8111-111111111111',
      'f1111111-1111-4111-8111-111111111103',
      'c1111111-1111-4111-8111-111111111102',
      'Warehouse — Night Receiving',
      'Costco distribution receiving (test)',
      CURRENT_DATE,
      CURRENT_DATE + 45,
      4,
      24.00,
      false
    ),
    (
      'b1111111-1111-4111-8111-111111111104',
      '8e13d397-263b-424a-8348-490c900550c0',
      'a1111111-1111-4111-8111-111111111111',
      'f1111111-1111-4111-8111-111111111104',
      'c1111111-1111-4111-8111-111111111103',
      'RN — Med-Surg',
      'Hospital med-surg RN (test)',
      CURRENT_DATE,
      CURRENT_DATE + 30,
      2,
      48.00,
      false
    )
  ON CONFLICT (id) DO NOTHING;

  -- Carl examples worker (auth user 01b9377d-53e6-48f8-a758-7f92aae7e01b): Amazon + CNA assignments
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '01b9377d-53e6-48f8-a758-7f92aae7e01b'::uuid) THEN
    INSERT INTO public.worker_shift_assignments (
      id, tenant_id, shift_id, worker_id, status, assigned_at
    ) VALUES
      (
        'd1111111-1111-4111-8111-111111111101',
        '8e13d397-263b-424a-8348-490c900550c0',
        'b1111111-1111-4111-8111-111111111102',
        '01b9377d-53e6-48f8-a758-7f92aae7e01b',
        'confirmed',
        NOW()
      ),
      (
        'd1111111-1111-4111-8111-111111111102',
        '8e13d397-263b-424a-8348-490c900550c0',
        'b1111111-1111-4111-8111-111111111101',
        '01b9377d-53e6-48f8-a758-7f92aae7e01b',
        'confirmed',
        NOW()
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
