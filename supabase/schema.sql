-- Beyond the Chatbot — Supabase schema
-- Apply in the Supabase SQL editor, then seed with: npm run seed

create table if not exists tickets (
  id uuid default gen_random_uuid() primary key,
  raw_text text not null,
  customer_name text,
  status text default 'pending', -- 'pending' | 'processed'
  created_at timestamp default now()
);

create table if not exists ticket_decisions (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references tickets(id),
  ticket_text text,
  ai_priority text,           -- 'low' | 'medium' | 'high' | 'urgent'
  ai_department text,         -- 'billing' | 'technical' | 'general' | 'refunds'
  ai_suggested_reply text,
  ai_confidence int,          -- 0-100
  ai_reasoning text,
  user_action text,           -- 'auto_sent' | 'approved' | 'edited' | 'skipped' | 'undone'
  final_reply text,
  undo_window_expires_at timestamp,
  created_at timestamp default now()
);