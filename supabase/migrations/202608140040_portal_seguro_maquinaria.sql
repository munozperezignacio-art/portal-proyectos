create extension if not exists pgcrypto;
alter table public.inventario_maquinaria add column if not exists publico_token text;
update public.inventario_maquinaria set publico_token = encode(gen_random_bytes(24), 'hex') where publico_token is null or btrim(publico_token) = '';
alter table public.inventario_maquinaria alter column empresa set not null;
alter table public.inventario_maquinaria alter column publico_token set not null;
alter table public.inventario_maquinaria alter column publico_token set default encode(gen_random_bytes(24), 'hex');
create unique index if not exists inventario_maquinaria_publico_token_uidx on public.inventario_maquinaria(publico_token);
create index if not exists inventario_maquinaria_empresa_idx on public.inventario_maquinaria(empresa);
