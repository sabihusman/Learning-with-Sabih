# Learn with Sabih: Synthetic Dataset for SQL Teaching

This folder contains a small, fully synthetic dataset that models Learn with Sabih, an interactive study guide for computer science concepts. It exists to teach product-analytics SQL: joins, GROUP BY aggregation, window functions, funnel conversion, and cohort retention. None of the data is real and none of it describes any real person. Every value was generated programmatically with a fixed random seed.

The dataset is intentionally small so you can verify results by hand. There are 50 users, 146 sessions, and 383 events.

## Files

- users.csv, sessions.csv, events.csv: the three tables as flat CSV.
- seed-data.json: all three tables in one JSON object, keyed by table name, for direct import into web interactives.
- schema.sql: CREATE TABLE statements plus INSERT statements so the data loads into local PostgreSQL.
- queries.sql: reference teaching queries in PostgreSQL, organized by topic, each commented with the concept it teaches and the result it returns.
- expected-results.md: the correct answers for the teaching queries, computed from the data in this folder rather than estimated.
- generate.py: the reproducible generator. Re-running it with the same seed reproduces every file exactly.

## What the product is

Learn with Sabih is an interactive study guide. A learner opens a topic, works through an interactive aid attached to that topic, and finishes by completing the topic. The dataset captures that behavior as users, the study sessions they run, and the events that happen inside each session.

## Schema

There are three tables.

users holds one row per learner.

- user_id: integer, primary key.
- signup_date: the date the learner registered. Signups are spread across 8 weeks so cohort analysis is meaningful.
- country: a two-letter country code drawn from a fixed list. Synthetic.
- plan: either 'free' or 'pro'.

sessions holds one row per study session.

- session_id: integer, primary key. Session ids are numbered in chronological order of started_at.
- user_id: integer, foreign key to users.user_id.
- started_at: timestamp when the session began.

events holds one row per in-app event.

- event_id: integer, primary key. Event ids are numbered in order of session and time.
- session_id: integer, foreign key to sessions.session_id.
- user_id: integer, foreign key to users.user_id. This always matches the user_id of the parent session, which lets you teach the difference between joining through sessions and reading user_id directly off the event.
- event: one of 'topic_opened', 'interactive_used', or 'topic_completed'.
- occurred_at: timestamp when the event happened.

## Foreign-key relationships

A learner has zero or more sessions. sessions.user_id references users.user_id.

A session has zero or more events. events.session_id references sessions.session_id.

An event also carries a denormalized user_id that references users.user_id and is always equal to the parent session's user_id.

The grain gets finer as you go down: one row per learner, then one row per session, then one row per event.

## Which table and column feeds each interactive

Joins. Start from users and LEFT JOIN sessions ON users.user_id = sessions.user_id to see every learner including those who never started a session. Add events with a further LEFT JOIN events ON sessions.session_id = events.session_id. The teaching point is that LEFT joins preserve unmatched rows and surface NULLs on the right side. The edge cases below are what make those NULLs appear.

GROUP BY aggregation. Group sessions or events by a users column such as country or plan, after joining, to count sessions per country, events per plan, and so on. users.plan and users.country are the natural grouping keys. sessions.session_id and events.event_id are the things you COUNT.

Window functions. Use events partitioned by session_id and ordered by occurred_at. The columns that matter are events.session_id for PARTITION BY and events.occurred_at for ORDER BY. Because at least one session has two events that share an identical occurred_at, ROW_NUMBER, RANK, and DENSE_RANK produce visibly different output, which is the whole point of teaching the three together.

Funnel conversion. Read the events.event column. The funnel is the learner journey: topic_opened, then interactive_used, then topic_completed. Count distinct events.session_id at each step to get the step sizes, then divide each step by the previous one for step-to-step conversion. The topic completion rate, which is the activation metric for this product, is the number of distinct sessions with a topic_completed event over the total number of sessions.

Cohort retention. Combine users.signup_date with sessions.started_at. Bucket each learner into a signup-week cohort from users.signup_date, then for each session compute the number of whole weeks between the learner's signup_date and sessions.started_at to get weeks since signup. The retention grid counts, per cohort, how many learners had any session in each later week.

## Funnel shape

Within a session the events follow topic_opened, then interactive_used, then topic_completed, with realistic drop-off. Almost every session has a topic_opened, about 55 percent of sessions reach interactive_used, and about 30 percent reach topic_completed. A session can contain more than one event of the same type, and every event in a session has its own ordered timestamp except for the one intentional tie described below. This gives window functions a real sequence to work on.

## Intentional edge cases

These are deliberate features of the dataset, not mistakes. They exist so the interactives teach the correct lessons.

A few learners have zero sessions. Users 47, 48, 49, and 50 never started a session. A LEFT join from users to sessions will produce NULL session columns for them, which is the intended lesson about LEFT joins and about COUNT ignoring NULLs.

A few sessions have zero events. Sessions 37, 74, and 110 contain no events. A LEFT join from sessions to events will produce NULL event columns for them, and these sessions correctly do not appear in any funnel step.

At least one session has two events with the identical timestamp. In session 1, two events share the exact same occurred_at. When you order by occurred_at, ROW_NUMBER still assigns distinct sequential numbers to the tied rows while RANK assigns them the same rank and then skips a value, and DENSE_RANK assigns them the same rank without skipping. This is the canonical example for explaining how the three functions differ on ties.

## Loading the data

For PostgreSQL, run schema.sql. It drops the three tables if they exist, recreates them with primary keys, foreign keys, and CHECK constraints on plan and event, then inserts every row. Then run queries.sql to reproduce the answer key.

For web interactives, load seed-data.json and read the users, sessions, and events arrays.

For quick inspection or for tools that prefer flat files, open the three CSV files directly.

## Reproducibility

generate.py fixes the random seed to 42. Running python3 generate.py regenerates users.csv, sessions.csv, events.csv, seed-data.json, schema.sql, and expected-results.md identically. The event labels are applied after all random draws, so this relabel from the earlier theme did not change any number: the row counts, funnel counts, percentages, cumulative total, and edge cases are exactly as before. If you change the seed or the generation parameters, regenerate expected-results.md from the same run so the answers continue to match the data.
