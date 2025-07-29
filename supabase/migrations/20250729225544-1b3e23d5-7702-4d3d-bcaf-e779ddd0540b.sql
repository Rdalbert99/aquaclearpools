-- Add some sample clients for the dashboard to display
INSERT INTO clients (id, user_id, customer, pool_size, pool_type, liner_type, status, last_service_date, created_at, updated_at) VALUES
(gen_random_uuid(), 'e6c05a10-4e70-4c11-b8a0-8013b9335c84', 'Johnson Pool Service', 25000, 'Chlorine', 'Liner', 'Active', '2025-07-25', now(), now()),
(gen_random_uuid(), 'e6c05a10-4e70-4c11-b8a0-8013b9335c84', 'Smith Family Pool', 32000, 'Salt', 'Concrete', 'Active', '2025-07-20', now(), now()),
(gen_random_uuid(), 'e6c05a10-4e70-4c11-b8a0-8013b9335c84', 'Wilson Estate Pool', 45000, 'Chlorine', 'Fiberglass', 'Active', '2025-07-15', now(), now())
ON CONFLICT DO NOTHING;

-- Add some sample service records
INSERT INTO services (id, client_id, technician_id, service_date, status, duration, cost, ph_level, chlorine_level, alkalinity_level, notes, created_at, updated_at) 
SELECT 
  gen_random_uuid(),
  c.id,
  '61777510-ac01-4ac0-b097-3189f3b472ee', -- tech user id
  '2025-07-28'::date,
  'completed',
  90,
  125.00,
  7.4,
  3.2,
  100,
  'Regular maintenance - pool is in good condition',
  now(),
  now()
FROM clients c 
LIMIT 3
ON CONFLICT DO NOTHING;