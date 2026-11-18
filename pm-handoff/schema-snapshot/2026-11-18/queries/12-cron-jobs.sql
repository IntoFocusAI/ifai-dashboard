-- 12 pg_cron jobs (metadata only; scrub secrets from command before saving)
select coalesce(jsonb_agg(jsonb_build_object('jobid',j.jobid,'jobname',j.jobname,'schedule',j.schedule,'database',j.database,'username',j.username,'active',j.active,'command',j.command) order by j.jobname, j.jobid),'[]') as result
from cron.job j;
