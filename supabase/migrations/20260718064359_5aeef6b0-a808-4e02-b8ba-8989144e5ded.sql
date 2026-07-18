
-- Fix match_note_chunks: ignore caller-supplied _user_id, use auth.uid()
CREATE OR REPLACE FUNCTION public.match_note_chunks(_user_id uuid, _note_id uuid, _query vector, _match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, content text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.content, 1 - (c.embedding <=> _query) AS similarity
  FROM public.note_chunks c
  WHERE c.user_id = auth.uid() AND c.note_id = _note_id
  ORDER BY c.embedding <=> _query
  LIMIT _match_count
$function$;

-- Fix mutable search_path on trigger helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END $function$;

-- Revoke public/anon EXECUTE on our SECURITY DEFINER functions; grant only to authenticated
REVOKE ALL ON FUNCTION public.match_note_chunks(uuid, uuid, vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_note_chunks(uuid, uuid, vector, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.can_view_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_student(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
