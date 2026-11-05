-- Preserve the existing authorization and cost-source logic; zero is a valid rate.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('private.maquinaria_cargo_para_imputar(text,integer,integer,date)'::regprocedure) into definition;
 if position('amount is null or amount<=0' in definition)=0 then
  raise exception 'Unexpected machinery cost validation; review before migrating';
 end if;
 execute replace(definition,'amount is null or amount<=0',
  'amount is null or amount<0 or amount::text in (''NaN'',''Infinity'',''-Infinity'')');
end $migration$;
