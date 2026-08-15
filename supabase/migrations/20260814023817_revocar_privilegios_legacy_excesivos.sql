revoke all privileges on public.obras,public.partidas_obra,public.avances_produccion_partidas from anon;
revoke truncate,references,trigger on public.obras,public.partidas_obra,public.avances_produccion_partidas from authenticated;
grant select on public.obras to anon;
grant select,insert,update,delete on public.obras,public.partidas_obra,public.avances_produccion_partidas to authenticated;;
