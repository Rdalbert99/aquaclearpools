-- Insert Cindy Thames review into the reviews table
INSERT INTO public.reviews (
  customer_name,
  review_text,
  rating,
  status,
  approved_at,
  created_at,
  updated_at
) VALUES (
  'Cindy Thames',
  'I hired Randy with Aquaclear 12 months ago. I had been struggling to find a dependable pool service. Randy was new in the industry and was available to help. My pool water went from a nasty green to crystal clear in a couple of weeks. I have been very pleased with his service and professional conduct. He always texts me after each visit to let me know the pool status and what he did on that visit. I highly recommend Randy with Aquaclear.',
  5,
  'approved',
  now(),
  now(),
  now()
);