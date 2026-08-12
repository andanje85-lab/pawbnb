REVOKE EXECUTE ON FUNCTION public.purge_old_function_errors() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_function_errors() TO service_role;