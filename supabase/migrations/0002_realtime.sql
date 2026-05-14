-- Add realtime publication for live match updates
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_events;
