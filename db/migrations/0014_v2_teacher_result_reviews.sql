BEGIN;
CREATE TABLE session_result_reviews (
 session_id uuid NOT NULL REFERENCES sessions(id), revision integer NOT NULL CHECK(revision>0),
 base_fingerprint text NOT NULL CHECK(base_fingerprint ~ '^[0-9a-f]{64}$'),
 request jsonb NOT NULL, author_id bigint NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,revision)
);
CREATE TRIGGER result_review_immutable BEFORE UPDATE OR DELETE ON session_result_reviews FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
CREATE FUNCTION chatusal_result_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM sessions WHERE id=NEW.session_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM sessions s JOIN cases c ON c.id=s.case_id JOIN users u ON u.id=NEW.author_id
  WHERE s.id=NEW.session_id AND s.status='finished' AND u.role IN ('teacher','admin') AND (u.role='admin' OR c.created_by=u.id)) THEN RAISE EXCEPTION 'review not authorized'; END IF;
 IF NEW.revision<>(SELECT coalesce(max(revision),0)+1 FROM session_result_reviews WHERE session_id=NEW.session_id) THEN RAISE EXCEPTION 'review revision conflict'; END IF;
 IF coalesce(btrim(NEW.request->>'reason'),'')='' OR (NEW.request->>'action') IS NULL OR NEW.request->>'action' NOT IN ('ACCEPT','CORRECT','COMMENT') THEN RAISE EXCEPTION 'review reason required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER result_review_guard BEFORE INSERT ON session_result_reviews FOR EACH ROW EXECUTE FUNCTION chatusal_result_review_guard();
ALTER TABLE session_result_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON session_result_reviews FROM PUBLIC;
COMMIT;
