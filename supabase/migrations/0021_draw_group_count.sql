-- Draw schedules its target group count; the actual random distribution
-- is computed when the timer expires (using teams as of that moment).
alter table public.draw_state add column if not exists group_count int default 2;
