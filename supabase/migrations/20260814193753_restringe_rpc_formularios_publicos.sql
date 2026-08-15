revoke all on function public.formulario_centros_gestion(text) from public, anon, authenticated;
revoke all on function public.formulario_catalogo_vinculado(text,text) from public, anon, authenticated;
grant execute on function public.formulario_centros_gestion(text) to service_role;
grant execute on function public.formulario_catalogo_vinculado(text,text) to service_role;

;
