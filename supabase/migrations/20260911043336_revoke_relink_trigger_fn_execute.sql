-- Trigger-only function: it fires from github_client_rules writes regardless
-- of EXECUTE, so nothing needs to call it over /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION public.relink_github_commits_on_rule_change() FROM PUBLIC, anon, authenticated;
