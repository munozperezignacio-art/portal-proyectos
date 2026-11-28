-- Require an explicit matching revision, including callers that pass NULL.
do $$ declare def text; begin
 def:=pg_get_functiondef('private.protocol_review_api(integer,text,uuid,integer)'::regprocedure);
 def:=replace(def,'rec.revision<>p_revision','rec.revision is distinct from p_revision');
 execute def;
end $$;
notify pgrst,'reload schema';
