-- queries.sql
-- Reference teaching queries for the synthetic Learn with Sabih dataset (interactive CS study guide).
-- PostgreSQL dialect, matching schema.sql. Load schema.sql first, then run these.
-- Every result below was checked against expected-results.md.
-- Comments are plain, no em-dashes.


-- ===================================================================
-- 1. JOINS: INNER vs LEFT
-- ===================================================================

-- INNER JOIN drops users who never started a session, so users 47 to 50 do not appear at all.
SELECT u.user_id, u.plan, s.session_id, s.started_at
FROM users u
INNER JOIN sessions s ON s.user_id = u.user_id
ORDER BY u.user_id, s.session_id;

-- LEFT JOIN keeps every user; the four zero-session users 47, 48, 49, 50 appear once with NULL session columns.
SELECT u.user_id, u.plan, s.session_id, s.started_at
FROM users u
LEFT JOIN sessions s ON s.user_id = u.user_id
ORDER BY u.user_id, s.session_id;

-- Isolate the zero-session users via the LEFT JOIN NULL test. Returns exactly user_id 47, 48, 49, 50.
SELECT u.user_id
FROM users u
LEFT JOIN sessions s ON s.user_id = u.user_id
WHERE s.session_id IS NULL
ORDER BY u.user_id;

-- Isolate the zero-event sessions via the LEFT JOIN NULL test. Returns exactly session_id 37, 74, 110.
SELECT s.session_id
FROM sessions s
LEFT JOIN events e ON e.session_id = s.session_id
WHERE e.event_id IS NULL
ORDER BY s.session_id;


-- ===================================================================
-- 2. GROUP BY: HAVING, and COUNT(*) vs COUNT(DISTINCT)
-- ===================================================================

-- COUNT(*) vs COUNT(session_id) over a LEFT JOIN. For users 47 to 50, COUNT(*) is 1 (the outer-joined NULL row) while COUNT(session_id) is 0. This is the classic COUNT(*) versus COUNT(column) trap.
SELECT u.user_id,
       u.plan,
       COUNT(*)             AS count_star_rows,
       COUNT(s.session_id)  AS count_sessions
FROM users u
LEFT JOIN sessions s ON s.user_id = u.user_id
GROUP BY u.user_id, u.plan
ORDER BY count_sessions, u.user_id;

-- COUNT(*) total events vs COUNT(DISTINCT session_id) distinct sessions, grouped by country. The two columns differ because sessions usually contain several events.
SELECT u.country,
       COUNT(*)                      AS total_events,
       COUNT(DISTINCT e.session_id)  AS distinct_sessions
FROM users u
INNER JOIN events e ON e.user_id = u.user_id
GROUP BY u.country
ORDER BY total_events DESC, u.country;

-- GROUP BY with HAVING: keep only countries whose users started more than 10 sessions in total. HAVING filters on the aggregate after grouping.
SELECT u.country,
       COUNT(s.session_id) AS sessions
FROM users u
INNER JOIN sessions s ON s.user_id = u.user_id
GROUP BY u.country
HAVING COUNT(s.session_id) > 10
ORDER BY sessions DESC, u.country;


-- ===================================================================
-- 3. WINDOW FUNCTIONS: ROW_NUMBER vs RANK vs DENSE_RANK, SUM() OVER, LAG
-- ===================================================================

-- ROW_NUMBER vs RANK vs DENSE_RANK on session 1, which has two events at the identical timestamp.
-- Matches expected-results.md: the tied pair gets rn 2 and 3, rank 2 and 2, dense_rank 2 and 2.
SELECT event_id,
       event,
       occurred_at,
       ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY occurred_at, event_id) AS rn,
       RANK()       OVER (PARTITION BY session_id ORDER BY occurred_at)           AS rnk,
       DENSE_RANK() OVER (PARTITION BY session_id ORDER BY occurred_at)           AS dns
FROM events
WHERE session_id = 1
ORDER BY occurred_at, event_id;

-- Running total of sessions by day using SUM() OVER. Reproduces the cumulative-sessions-by-day column in expected-results.md, ending at 146.
SELECT started_at::date AS day,
       COUNT(*)         AS sessions_that_day,
       SUM(COUNT(*)) OVER (ORDER BY started_at::date
                           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_sessions
FROM sessions
GROUP BY started_at::date
ORDER BY day;

-- LAG: time gap between each user's consecutive sessions. The first session per user returns NULL because there is no previous row in the partition.
SELECT user_id,
       session_id,
       started_at,
       started_at - LAG(started_at) OVER (PARTITION BY user_id ORDER BY started_at) AS gap_from_previous_session
FROM sessions
ORDER BY user_id, started_at;


-- ===================================================================
-- 4. FUNNEL: CTE producing the three step counts and step-to-step percentages
-- ===================================================================

-- Funnel step counts and step-to-step conversion. Matches expected-results.md: topic_opened 143, interactive_used 77 (53.8% of topic_opened), topic_completed 45 (58.4% of interactive_used).
WITH step_counts AS (
    SELECT
        COUNT(DISTINCT session_id) FILTER (WHERE event = 'topic_opened')            AS topic_opened,
        COUNT(DISTINCT session_id) FILTER (WHERE event = 'interactive_used') AS interactive_used,
        COUNT(DISTINCT session_id) FILTER (WHERE event = 'topic_completed')       AS topic_completed
    FROM events
),
funnel AS (
    SELECT 1 AS step_order, 'topic_opened'            AS step, topic_opened            AS sessions, NULL::int AS prev_step FROM step_counts
    UNION ALL
    SELECT 2,               'interactive_used',       interactive_used,        topic_opened            FROM step_counts
    UNION ALL
    SELECT 3,               'topic_completed',             topic_completed,              interactive_used FROM step_counts
)
SELECT step,
       sessions,
       ROUND(100.0 * sessions / NULLIF(prev_step, 0), 1) AS pct_of_previous_step
FROM funnel
ORDER BY step_order;

-- Topic completion rate (the activation metric): distinct sessions with a topic_completed over all sessions. Matches expected-results.md: 45 / 146 = 30.8%.
SELECT
    COUNT(DISTINCT session_id) FILTER (WHERE event = 'topic_completed') AS activated_sessions,
    (SELECT COUNT(*) FROM sessions)                                    AS total_sessions,
    ROUND(100.0 * COUNT(DISTINCT session_id) FILTER (WHERE event = 'topic_completed')
          / (SELECT COUNT(*) FROM sessions), 1)                       AS activation_rate_pct
FROM events;


-- ===================================================================
-- 5. COHORT RETENTION: signup week by weeks since signup
-- ===================================================================

-- Cohort retention grid. Cohorts are signup weeks anchored to the Monday of the first signup week
-- via DATE_TRUNC('week', ...), which starts weeks on Monday. Weeks since signup are whole weeks
-- between each session and the user's own signup_date. Each cell counts distinct users in the
-- cohort active in that relative week. Matches the cohort grid in expected-results.md
-- (for example Week 0 has size 6 with W0..W6 = 6, 2, 3, 1, 2, 2, 0).
WITH cohort AS (
    SELECT u.user_id,
           u.signup_date,
           (DATE_TRUNC('week', u.signup_date)::date
            - DATE_TRUNC('week', (SELECT MIN(signup_date) FROM users))::date) / 7 AS signup_week
    FROM users u
),
activity AS (
    SELECT DISTINCT
           c.user_id,
           c.signup_week,
           ((s.started_at::date - c.signup_date) / 7) AS weeks_since_signup
    FROM cohort c
    INNER JOIN sessions s ON s.user_id = c.user_id
    WHERE s.started_at::date >= c.signup_date
)
SELECT c.signup_week,
       COUNT(DISTINCT c.user_id)                                              AS cohort_size,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.weeks_since_signup = 0)      AS w0,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.weeks_since_signup = 1)      AS w1,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.weeks_since_signup = 2)      AS w2,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.weeks_since_signup = 3)      AS w3,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.weeks_since_signup = 4)      AS w4,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.weeks_since_signup = 5)      AS w5,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.weeks_since_signup = 6)      AS w6
FROM cohort c
LEFT JOIN activity a ON a.user_id = c.user_id
GROUP BY c.signup_week
ORDER BY c.signup_week;
