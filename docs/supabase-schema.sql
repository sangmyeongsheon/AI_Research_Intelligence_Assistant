-- LabTrace future Supabase/PostgreSQL schema
-- All demo people and records are fictional. This schema is not activated by
-- the current MVP, which uses browser IndexedDB.
--
-- Before production use:
--   1. add authentication and lab membership tables,
--   2. enable and test RLS on every table,
--   3. define Storage policies and retention,
--   4. review institutional research-data requirements.

begin;

create extension if not exists pgcrypto;

create table if not exists public.labs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  field text not null default '',
  description text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint labs_name_not_blank check (length(btrim(name)) > 0),
  constraint labs_short_name_not_blank check (length(btrim(short_name)) > 0)
);

create table if not exists public.protocols (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs(id) on update cascade on delete cascade,
  title text not null,
  objective text not null default '',
  category text not null default 'experiment',
  status text not null default 'draft',
  current_version integer not null default 1,
  tags text[] not null default '{}',
  created_by text not null default '작성자 미상',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protocols_title_not_blank check (length(btrim(title)) > 0),
  constraint protocols_category_check
    check (category in ('experiment', 'equipment', 'troubleshooting')),
  constraint protocols_status_check
    check (status in ('draft', 'review', 'approved', 'archived')),
  constraint protocols_version_positive check (current_version >= 1)
);

create table if not exists public.protocol_versions (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols(id) on update cascade on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  change_summary text not null default '',
  changed_by text not null default '작성자 미상',
  created_at timestamptz not null default now(),
  constraint protocol_versions_number_positive check (version_number >= 1),
  constraint protocol_versions_snapshot_object
    check (jsonb_typeof(snapshot) = 'object'),
  constraint protocol_versions_protocol_number_unique
    unique (protocol_id, version_number)
);

create table if not exists public.source_artifacts (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid references public.protocols(id) on update cascade on delete cascade,
  -- Temporary upload workspaces may exist before a protocol is generated.
  -- Replace this text key with a workspace FK when a workspaces table is added.
  workspace_id text,
  type text not null,
  file_name text not null,
  display_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  author text not null default '작성자 미상',
  source_date date,
  reliability text not null default 'unknown',
  notes text not null default '',
  -- Storage object key only. Never store a service-role key or signed URL here.
  local_blob_key text,
  extracted_text text,
  processing_status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint source_artifacts_owner_present
    check (protocol_id is not null or nullif(btrim(workspace_id), '') is not null),
  constraint source_artifacts_type_check
    check (type in ('audio', 'image', 'pdf', 'text', 'markdown', 'transcript')),
  constraint source_artifacts_reliability_check
    check (reliability in ('current', 'legacy', 'reference', 'unknown')),
  constraint source_artifacts_processing_status_check
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  constraint source_artifacts_size_nonnegative check (size_bytes >= 0),
  constraint source_artifacts_file_name_not_blank check (length(btrim(file_name)) > 0)
);

create table if not exists public.source_excerpts (
  id uuid primary key default gen_random_uuid(),
  source_artifact_id uuid not null
    references public.source_artifacts(id) on update cascade on delete cascade,
  excerpt_text text not null,
  page_number integer,
  timestamp_start double precision,
  timestamp_end double precision,
  bounding_description text,
  confidence double precision not null default 0,
  author text,
  source_date date,
  created_at timestamptz not null default now(),
  constraint source_excerpts_page_positive
    check (page_number is null or page_number >= 1),
  constraint source_excerpts_timestamp_start_nonnegative
    check (timestamp_start is null or timestamp_start >= 0),
  constraint source_excerpts_timestamp_order
    check (
      timestamp_end is null
      or timestamp_start is null
      or timestamp_end >= timestamp_start
    ),
  constraint source_excerpts_confidence_range
    check (confidence >= 0 and confidence <= 1)
);

create table if not exists public.conflicts (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols(id) on update cascade on delete cascade,
  field text not null,
  step_id text,
  description text not null,
  -- Array of { id, label/value, sourceRefs } objects.
  options jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  severity text not null default 'medium',
  status text not null default 'unresolved',
  selected_resolution text,
  resolution_note text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conflicts_severity_check check (severity in ('low', 'medium', 'high')),
  constraint conflicts_status_check check (status in ('unresolved', 'resolved')),
  constraint conflicts_options_array check (jsonb_typeof(options) = 'array'),
  constraint conflicts_source_refs_array check (jsonb_typeof(source_refs) = 'array'),
  constraint conflicts_resolution_consistency check (
    (status = 'unresolved' and selected_resolution is null and resolved_at is null)
    or (status = 'resolved' and nullif(btrim(selected_resolution), '') is not null)
  )
);

create table if not exists public.missing_fields (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols(id) on update cascade on delete cascade,
  field text not null,
  step_id text,
  reason text not null,
  question text not null,
  severity text not null default 'medium',
  status text not null default 'unresolved',
  user_answer text,
  answered_by text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint missing_fields_severity_check check (severity in ('low', 'medium', 'high')),
  constraint missing_fields_status_check
    check (status in ('unresolved', 'answered', 'dismissed')),
  constraint missing_fields_answer_consistency check (
    (status <> 'answered')
    or (
      nullif(btrim(user_answer), '') is not null
      and nullif(btrim(answered_by), '') is not null
      and answered_at is not null
    )
  )
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols(id) on update cascade on delete cascade,
  role text not null,
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  suggestion_type text,
  created_at timestamptz not null default now(),
  constraint chat_messages_role_check
    check (role in ('system', 'user', 'assistant')),
  constraint chat_messages_content_not_blank check (length(btrim(content)) > 0),
  constraint chat_messages_citations_array check (jsonb_typeof(citations) = 'array'),
  constraint chat_messages_suggestion_type_check check (
    suggestion_type is null
    or suggestion_type in ('source_backed', 'clarification_question', 'ai_idea')
  )
);

-- Primary navigation and filtering.
create index if not exists labs_is_demo_updated_idx
  on public.labs (is_demo, updated_at desc);
create unique index if not exists labs_short_name_lower_unique_idx
  on public.labs (lower(short_name));

create index if not exists protocols_lab_updated_idx
  on public.protocols (lab_id, updated_at desc);
create index if not exists protocols_lab_status_idx
  on public.protocols (lab_id, status);
create index if not exists protocols_lab_category_idx
  on public.protocols (lab_id, category);
create index if not exists protocols_tags_gin_idx
  on public.protocols using gin (tags);
create index if not exists protocols_title_search_idx
  on public.protocols using gin (to_tsvector('simple', coalesce(title, '')));

create index if not exists protocol_versions_protocol_created_idx
  on public.protocol_versions (protocol_id, created_at desc);
create index if not exists protocol_versions_snapshot_gin_idx
  on public.protocol_versions using gin (snapshot jsonb_path_ops);

create index if not exists source_artifacts_protocol_created_idx
  on public.source_artifacts (protocol_id, created_at);
create index if not exists source_artifacts_workspace_created_idx
  on public.source_artifacts (workspace_id, created_at)
  where workspace_id is not null;
create index if not exists source_artifacts_type_status_idx
  on public.source_artifacts (type, processing_status);
create index if not exists source_artifacts_reliability_date_idx
  on public.source_artifacts (reliability, source_date desc);

create index if not exists source_excerpts_artifact_page_idx
  on public.source_excerpts (source_artifact_id, page_number);
create index if not exists source_excerpts_artifact_time_idx
  on public.source_excerpts (source_artifact_id, timestamp_start);

create index if not exists conflicts_protocol_status_severity_idx
  on public.conflicts (protocol_id, status, severity);
create index if not exists conflicts_protocol_step_idx
  on public.conflicts (protocol_id, step_id)
  where step_id is not null;

create index if not exists missing_fields_protocol_status_severity_idx
  on public.missing_fields (protocol_id, status, severity);
create index if not exists missing_fields_protocol_step_idx
  on public.missing_fields (protocol_id, step_id)
  where step_id is not null;

create index if not exists chat_messages_protocol_created_idx
  on public.chat_messages (protocol_id, created_at);

-- Keep mutable header rows current. Version rows are immutable by application convention.
create or replace function public.set_labtrace_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists labs_set_updated_at on public.labs;
create trigger labs_set_updated_at
before update on public.labs
for each row execute function public.set_labtrace_updated_at();

drop trigger if exists protocols_set_updated_at on public.protocols;
create trigger protocols_set_updated_at
before update on public.protocols
for each row execute function public.set_labtrace_updated_at();

comment on table public.protocol_versions is
  'Immutable protocol snapshots. Application writes a new row for each reviewed change.';
comment on column public.source_artifacts.local_blob_key is
  'Future object-storage key; never an API key, service-role token, or permanent signed URL.';
comment on column public.conflicts.source_refs is
  'SourceRef JSON array retained for evidence traceability.';
comment on column public.chat_messages.citations is
  'SourceRef JSON array used by clickable chat citations.';

-- RLS is intentionally not enabled here because the MVP has no authentication
-- or lab-membership model. Do not expose these tables to clients until explicit
-- lab membership policies have been added and tested.

commit;
