-- Run after creating one admin user through Supabase Auth.
-- Replace the email below with your admin account email.
with admin_profile as (
  select id from public.profiles where email = 'admin@example.com' limit 1
),
new_binder as (
  insert into public.binders (
    owner_id,
    title,
    slug,
    description,
    subject,
    level,
    status,
    price_cents,
    pinned,
    cover_url
  )
  select
    id,
    'Calculus I: Patterns Before Procedures',
    'calculus-patterns-before-procedures',
    'Limits, derivatives, and graph reasoning for math-heavy students.',
    'Mathematics',
    'College foundations',
    'published',
    3900,
    true,
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1400&q=82'
  from admin_profile
  on conflict (slug) do update set updated_at = now()
  returning id
)
insert into public.binder_lessons (
  binder_id,
  title,
  order_index,
  content,
  math_blocks,
  is_preview
)
select
  id,
  'Limits are local predictions',
  1,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"A limit asks what a function is trying to become near a point. Before calculating, sketch the behavior, mark the input being approached, and describe the trend in plain language."}]}]}'::jsonb,
  '[{"id":"seed-latex","type":"latex","latex":"\\lim_{x\\to 2}(x^2+1)=5"},{"id":"seed-graph","type":"graph","expressions":["y=x^2","y=2x+1"],"xMin":-5,"xMax":5,"yMin":-5,"yMax":10}]'::jsonb,
  true
from new_binder;
