-- Keep the diagram as it was when a change was requested, so the review screen can show
-- the redraw beside it. Safe to run twice.
alter table public.diagram_requests add column if not exists before_diagram jsonb;
