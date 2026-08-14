-- Se aplica junto con el importador seguro, para no interrumpir el importador vigente.
update public.config_empresa set gemini_api_key = null where gemini_api_key is not null;
alter table public.config_empresa drop column if exists gemini_api_key;
alter table public.config_empresa drop column if exists gemini_model;
