
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_host_response_stats(_host_id uuid)
RETURNS TABLE(response_rate numeric, avg_response_minutes integer, sample_size integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH host_bookings AS (
    SELECT b.id
    FROM public.bookings b
    JOIN public.listings l ON l.id = b.listing_id
    WHERE l.host_id = _host_id
  ),
  first_inbound AS (
    SELECT m.booking_id, MIN(m.created_at) AS first_inbound_at
    FROM public.messages m
    JOIN host_bookings hb ON hb.id = m.booking_id
    WHERE m.recipient_id = _host_id
    GROUP BY m.booking_id
  ),
  first_reply AS (
    SELECT
      fi.booking_id,
      fi.first_inbound_at,
      (
        SELECT MIN(m2.created_at)
        FROM public.messages m2
        WHERE m2.booking_id = fi.booking_id
          AND m2.sender_id = _host_id
          AND m2.created_at > fi.first_inbound_at
      ) AS first_reply_at
    FROM first_inbound fi
  )
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        SUM(CASE
              WHEN first_reply_at IS NOT NULL
               AND (first_reply_at - first_inbound_at) <= interval '24 hours'
              THEN 1 ELSE 0
            END)::numeric / COUNT(*),
        3
      )
    END AS response_rate,
    COALESCE(
      ROUND(
        AVG(EXTRACT(EPOCH FROM (first_reply_at - first_inbound_at)) / 60.0)
        FILTER (WHERE first_reply_at IS NOT NULL)
      )::integer,
      0
    ) AS avg_response_minutes,
    COUNT(*)::integer AS sample_size
  FROM first_reply;
$$;

GRANT EXECUTE ON FUNCTION public.get_host_response_stats(uuid) TO anon, authenticated;
