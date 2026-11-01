-- Booking-requests table for TB Cosmetology.
-- Run once in Supabase: SQL Editor → New query → paste → Run.

create extension if not exists pgcrypto;

create table if not exists public.booking_requests (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  status            text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  topic             text not null,
  requested_date    date not null,
  requested_time    text not null,           -- "10:30" or morning/noon/evening
  time_mode         text not null default 'preference' check (time_mode in ('slot', 'preference')),
  full_name         text not null check (char_length(full_name) between 2 and 80),
  phone             text not null check (phone ~ '^05[0-9]{8}$'),
  note              text check (char_length(note) <= 500),
  consent           boolean not null default false,
  ip_hash           text,                     -- hashed IP only, for spam protection
  decided_at        timestamptz,
  appointment_start timestamptz,              -- set only when Tanya approves
  calendar_event_id text,
  reminder_sent_at  timestamptz
);

create index if not exists booking_requests_status_start on public.booking_requests (status, appointment_start);
create index if not exists booking_requests_created on public.booking_requests (created_at);
create index if not exists booking_requests_phone on public.booking_requests (phone, created_at);

-- Row Level Security on with no policies at all:
-- nobody can read or write from the browser. Only the server (service role key) has access.
alter table public.booking_requests enable row level security;
