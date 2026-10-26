-- Avoid conflict between the PL/pgSQL row variable s and the list table alias.
do $repair$
declare definition text; original text; replacement text;
begin
 select pg_get_functiondef('private.solicitudes_operar(integer,text,jsonb)'::regprocedure) into definition;
 original := substring(definition from 'select s\.\*,coalesce[\s\S]*?\) q;');
 if original is null then raise exception 'List query not found; inspect before changing'; end if;
 replacement := replace(original,'s.','listed.');
 replacement := replace(replacement,'public.solicitudes s join','public.solicitudes listed join');
 execute replace(definition,original,replacement);
end $repair$;
