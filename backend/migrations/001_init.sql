create table if not exists users (
    id uuid primary key references auth.users(id),
    email text not null,
    created_at timestamptz not null default now()
);

create table if not exists products (
    id bigserial primary key,
    user_id uuid not null references users(id),
    category text not null check (category in ('apparel', 'jewelry')),
    original_image_url text not null,
    cutout_image_url text,
    created_at timestamptz not null default now()
);

create table if not exists model_library (
    id bigserial primary key,
    name text not null,
    base_image_urls jsonb not null,
    active boolean not null default true
);

create table if not exists jobs (
    id bigserial primary key,
    user_id uuid not null references users(id),
    product_id bigint not null references products(id),
    model_id bigint not null references model_library(id),
    status text not null default 'pending' check (status in ('pending', 'processing', 'complete', 'needs_review', 'failed')),
    result_urls jsonb,
    placement_confidence float,
    created_at timestamptz not null default now(),
    error text
);

create table if not exists catalogues (
    id bigserial primary key,
    user_id uuid not null references users(id),
    job_ids bigint[] not null,
    pdf_url text,
    created_at timestamptz not null default now()
);
