do $$
declare
  policy_record record;
  affected_count integer;
begin
  with candidates as (
    select
      qual,
      with_check,
      regexp_replace(coalesce(qual, ''), '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi') as optimized_qual,
      regexp_replace(coalesce(with_check, ''), '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi') as optimized_check
    from pg_policies
    where schemaname = 'public'
  )
  select count(*)
    into affected_count
  from candidates
  where coalesce(qual, '') <> optimized_qual
     or coalesce(with_check, '') <> optimized_check;

  if affected_count <> 24 then
    raise exception 'Expected exactly 24 RLS policies, found %; migration aborted', affected_count;
  end if;

  for policy_record in
    select
      schemaname,
      tablename,
      policyname,
      qual,
      with_check,
      regexp_replace(coalesce(qual, ''), '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi') as optimized_qual,
      regexp_replace(coalesce(with_check, ''), '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi') as optimized_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') <> regexp_replace(coalesce(qual, ''), '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi')
        or coalesce(with_check, '') <> regexp_replace(coalesce(with_check, ''), '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi')
      )
  loop
    execute format(
      'alter policy %I on %I.%I%s%s',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename,
      case when policy_record.qual is not null
        then format(' using (%s)', policy_record.optimized_qual)
        else ''
      end,
      case when policy_record.with_check is not null
        then format(' with check (%s)', policy_record.optimized_check)
        else ''
      end
    );
  end loop;
end
$$;;
