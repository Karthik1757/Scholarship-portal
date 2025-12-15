-- Create notifications table
create table if not exists public.notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'system'::text, -- 'new_match', 'deadline', 'application_update', 'system'
  is_read boolean not null default false,
  created_at timestamp with time zone not null default now(),
  primary key (id)
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Policies
create policy "Users can view their own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update their own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- Insert some dummy notifications for testing (optional, remove in production)
-- This assumes you have a user. In a real migration, you wouldn't do this blindly.
