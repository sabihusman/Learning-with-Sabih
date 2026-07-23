#!/usr/bin/env python3
"""
Reproducible synthetic dataset generator for a product-analytics SQL teaching section.
Models Learn with Sabih, an interactive study guide for CS concepts. No real or personal data is used.

Run: python3 generate.py
All deliverables are written to OUTPUT_DIR.
"""

import csv
import json
import random
from datetime import datetime, timedelta, date
from collections import defaultdict, OrderedDict

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
SEED = 42
random.seed(SEED)

OUTPUT_DIR = "/sessions/wizardly-pensive-albattani/mnt/Learn with Sabih"

START = date(2025, 1, 6)          # a Monday; signups spread over 8 weeks from here
SIGNUP_WEEKS = 8
N_USERS = 50

COUNTRIES = ["US", "GB", "DE", "FR", "BR", "JP", "IN", "MX", "ES", "CA"]

# Users that will deliberately have zero sessions (edge case: LEFT join NULLs)
ZERO_SESSION_USERS = [47, 48, 49, 50]

# Sessions that will deliberately have zero events (edge case: LEFT join NULLs).
# Chosen by position in the generated session list (filled in after sessions exist).
N_ZERO_EVENT_SESSIONS = 3

# Funnel probabilities (measured as distinct sessions reaching each step)
P_SELECT = 0.56                   # ~55% of sessions reach interactive_used (after randomness)
P_COMPARE_OVERALL = 0.28          # ~30% of sessions reach topic_completed

# ----------------------------------------------------------------------
# 1. Users
# ----------------------------------------------------------------------
users = []
for uid in range(1, N_USERS + 1):
    offset_days = random.randint(0, SIGNUP_WEEKS * 7 - 1)   # 0..55
    signup = START + timedelta(days=offset_days)
    country = random.choice(COUNTRIES)
    plan = "pro" if random.random() < 0.30 else "free"
    users.append({
        "user_id": uid,
        "signup_date": signup.isoformat(),
        "country": country,
        "plan": plan,
    })

signup_by_user = {u["user_id"]: date.fromisoformat(u["signup_date"]) for u in users}

# ----------------------------------------------------------------------
# 2. Sessions
# ----------------------------------------------------------------------
# Active users get 1..6 sessions; some sessions land in later weeks (returning use).
active_users = [u["user_id"] for u in users if u["user_id"] not in ZERO_SESSION_USERS]

sessions = []
session_id = 1
for uid in active_users:
    n_sessions = random.choices([1, 2, 3, 4, 5, 6], weights=[18, 24, 24, 18, 10, 6])[0]
    signup = signup_by_user[uid]
    for s in range(n_sessions):
        if s == 0:
            # first session on or shortly after signup
            day_offset = random.randint(0, 3)
        else:
            # returning sessions land days to weeks later
            day_offset = random.randint(4, 45)
        started_day = signup + timedelta(days=day_offset)
        hour = random.randint(7, 22)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        started_at = datetime(started_day.year, started_day.month, started_day.day,
                              hour, minute, second)
        sessions.append({
            "session_id": session_id,
            "user_id": uid,
            "started_at": started_at,
        })
        session_id += 1

# Sort sessions chronologically and renumber session_id so ids follow time order.
sessions.sort(key=lambda x: x["started_at"])
for new_id, s in enumerate(sessions, start=1):
    s["session_id"] = new_id

# Pick the zero-event sessions (spread across the timeline, not the very first ones)
zero_event_session_ids = set()
candidate_positions = [len(sessions) // 4, len(sessions) // 2, (3 * len(sessions)) // 4]
for pos in candidate_positions:
    zero_event_session_ids.add(sessions[pos]["session_id"])

# ----------------------------------------------------------------------
# 3. Events
# ----------------------------------------------------------------------
# Per session funnel:
#   topic_opened  : always at least one (all land), 1..2 of them
#   interactive_used : with P_SELECT, 1..2 of them
#   topic_completed       : only if selected; conditional prob to hit ~P_COMPARE_OVERALL
P_COMPARE_GIVEN_SELECT = P_COMPARE_OVERALL / P_SELECT

events = []
event_id = 1

# Choose one session (with selection and comparison) to carry the identical-timestamp pair.
identical_ts_session_id = None

for s in sessions:
    sid = s["session_id"]
    uid = s["user_id"]
    if sid in zero_event_session_ids:
        continue  # deliberately no events

    t = s["started_at"]
    ordered = []  # (occurred_at, event_type)

    # topic_opened(s)
    n_pv = random.choices([1, 2, 3], weights=[55, 35, 10])[0]
    for _ in range(n_pv):
        t = t + timedelta(seconds=random.randint(3, 40))
        ordered.append((t, "topic_opened"))

    selected = random.random() < P_SELECT
    if selected:
        n_sel = random.choices([1, 2], weights=[65, 35])[0]
        for _ in range(n_sel):
            t = t + timedelta(seconds=random.randint(5, 60))
            ordered.append((t, "interactive_used"))

        compared = random.random() < P_COMPARE_GIVEN_SELECT
        if compared:
            n_cmp = random.choices([1, 2], weights=[75, 25])[0]
            for _ in range(n_cmp):
                t = t + timedelta(seconds=random.randint(5, 90))
                ordered.append((t, "topic_completed"))

    for occurred_at, etype in ordered:
        events.append({
            "event_id": event_id,
            "session_id": sid,
            "user_id": uid,
            "event": etype,
            "occurred_at": occurred_at,
        })
        event_id += 1

# Inject the identical-timestamp edge case: find a session that has at least two
# events of distinct types after a topic_opened, and force its 2nd and 3rd events to
# share the exact same occurred_at. This makes ROW_NUMBER / RANK / DENSE_RANK differ.
events_by_session = defaultdict(list)
for e in events:
    events_by_session[e["session_id"]].append(e)

for sid, evs in events_by_session.items():
    if len(evs) >= 3:
        evs_sorted = sorted(evs, key=lambda e: e["occurred_at"])
        # force the 2nd and 3rd events to share a timestamp
        evs_sorted[2]["occurred_at"] = evs_sorted[1]["occurred_at"]
        identical_ts_session_id = sid
        break

# Re-sort events globally by (session, occurred_at, event_id) and renumber event_id
events.sort(key=lambda e: (e["session_id"], e["occurred_at"], e["event_id"]))
for new_id, e in enumerate(events, start=1):
    e["event_id"] = new_id

# Stringify timestamps for output
for s in sessions:
    s["started_at"] = s["started_at"].strftime("%Y-%m-%d %H:%M:%S")
for e in events:
    e["occurred_at"] = e["occurred_at"].strftime("%Y-%m-%d %H:%M:%S")

# ----------------------------------------------------------------------
# Write CSVs
# ----------------------------------------------------------------------
def write_csv(path, rows, fields):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r[k] for k in fields})

write_csv(f"{OUTPUT_DIR}/users.csv", users,
          ["user_id", "signup_date", "country", "plan"])
write_csv(f"{OUTPUT_DIR}/sessions.csv", sessions,
          ["session_id", "user_id", "started_at"])
write_csv(f"{OUTPUT_DIR}/events.csv", events,
          ["event_id", "session_id", "user_id", "event", "occurred_at"])

# ----------------------------------------------------------------------
# Write seed-data.json
# ----------------------------------------------------------------------
seed = {"users": users, "sessions": sessions, "events": events}
with open(f"{OUTPUT_DIR}/seed-data.json", "w") as f:
    json.dump(seed, f, indent=2)

# ----------------------------------------------------------------------
# Write schema.sql
# ----------------------------------------------------------------------
def sql_str(v):
    return "'" + str(v).replace("'", "''") + "'"

with open(f"{OUTPUT_DIR}/schema.sql", "w") as f:
    f.write("-- Synthetic Learn with Sabih dataset (interactive CS study guide) for SQL teaching. Fully synthetic.\n")
    f.write("-- Generated reproducibly with seed = %d.\n\n" % SEED)
    f.write("DROP TABLE IF EXISTS events;\n")
    f.write("DROP TABLE IF EXISTS sessions;\n")
    f.write("DROP TABLE IF EXISTS users;\n\n")

    f.write("CREATE TABLE users (\n")
    f.write("    user_id     INTEGER PRIMARY KEY,\n")
    f.write("    signup_date DATE NOT NULL,\n")
    f.write("    country     TEXT NOT NULL,\n")
    f.write("    plan        TEXT NOT NULL CHECK (plan IN ('free', 'pro'))\n")
    f.write(");\n\n")

    f.write("CREATE TABLE sessions (\n")
    f.write("    session_id INTEGER PRIMARY KEY,\n")
    f.write("    user_id    INTEGER NOT NULL REFERENCES users(user_id),\n")
    f.write("    started_at TIMESTAMP NOT NULL\n")
    f.write(");\n\n")

    f.write("CREATE TABLE events (\n")
    f.write("    event_id    INTEGER PRIMARY KEY,\n")
    f.write("    session_id  INTEGER NOT NULL REFERENCES sessions(session_id),\n")
    f.write("    user_id     INTEGER NOT NULL REFERENCES users(user_id),\n")
    f.write("    event       TEXT NOT NULL CHECK (event IN ('topic_opened', 'interactive_used', 'topic_completed')),\n")
    f.write("    occurred_at TIMESTAMP NOT NULL\n")
    f.write(");\n\n")

    f.write("-- users\n")
    for u in users:
        f.write("INSERT INTO users (user_id, signup_date, country, plan) VALUES (%d, %s, %s, %s);\n"
                % (u["user_id"], sql_str(u["signup_date"]), sql_str(u["country"]), sql_str(u["plan"])))
    f.write("\n-- sessions\n")
    for s in sessions:
        f.write("INSERT INTO sessions (session_id, user_id, started_at) VALUES (%d, %d, %s);\n"
                % (s["session_id"], s["user_id"], sql_str(s["started_at"])))
    f.write("\n-- events\n")
    for e in events:
        f.write("INSERT INTO events (event_id, session_id, user_id, event, occurred_at) VALUES (%d, %d, %d, %s, %s);\n"
                % (e["event_id"], e["session_id"], e["user_id"], sql_str(e["event"]), sql_str(e["occurred_at"])))

# ----------------------------------------------------------------------
# Compute expected results FROM the generated data
# ----------------------------------------------------------------------
sessions_with_events = set(e["session_id"] for e in events)

# Funnel: distinct sessions reaching each step
sess_with_pv = set(e["session_id"] for e in events if e["event"] == "topic_opened")
sess_with_sel = set(e["session_id"] for e in events if e["event"] == "interactive_used")
sess_with_cmp = set(e["session_id"] for e in events if e["event"] == "topic_completed")

n_pv = len(sess_with_pv)
n_sel = len(sess_with_sel)
n_cmp = len(sess_with_cmp)

total_sessions = len(sessions)
distinct_sessions_any_event = len(sessions_with_events)

# Activation rate: distinct sessions with topic_completed / distinct sessions
activation_rate = n_cmp / total_sessions

conv_sel = (n_sel / n_pv * 100) if n_pv else 0
conv_cmp = (n_cmp / n_sel * 100) if n_sel else 0

# ROW_NUMBER / RANK / DENSE_RANK example for the identical-timestamp session
example_sid = identical_ts_session_id
example_events = sorted(
    [e for e in events if e["session_id"] == example_sid],
    key=lambda e: (e["occurred_at"], e["event_id"]),
)
# Compute RANK / DENSE_RANK over occurred_at (ties share rank)
row_number = []
rank = []
dense_rank = []
prev_ts = None
cur_rank = 0
cur_dense = 0
for i, e in enumerate(example_events, start=1):
    row_number.append(i)
    if e["occurred_at"] != prev_ts:
        cur_rank = i
        cur_dense += 1
        prev_ts = e["occurred_at"]
    rank.append(cur_rank)
    dense_rank.append(cur_dense)

# Cumulative sessions by day
sessions_by_day = defaultdict(int)
for s in sessions:
    d = s["started_at"][:10]
    sessions_by_day[d] += 1
cumulative = []
running = 0
for d in sorted(sessions_by_day):
    running += sessions_by_day[d]
    cumulative.append((d, sessions_by_day[d], running))

# Cohort retention: signup week (cohort) x weeks since signup
# cohort week index = floor((signup_date - START)/7)
def signup_week_index(d):
    return (d - START).days // 7

cohort_users = defaultdict(set)
for u in users:
    w = signup_week_index(date.fromisoformat(u["signup_date"]))
    cohort_users[w].add(u["user_id"])

# For each user, which weeks-since-signup had at least one session
user_active_rel_weeks = defaultdict(set)
for s in sessions:
    uid = s["user_id"]
    sdate = date.fromisoformat(s["started_at"][:10])
    rel = (sdate - signup_by_user[uid]).days // 7
    if rel >= 0:
        user_active_rel_weeks[uid].add(rel)

max_rel = 0
for weeks in user_active_rel_weeks.values():
    if weeks:
        max_rel = max(max_rel, max(weeks))

cohorts_sorted = sorted(cohort_users)
# retention grid: cohort -> {rel_week -> count of users active that rel week}
retention = OrderedDict()
for c in cohorts_sorted:
    size = len(cohort_users[c])
    row = {"size": size, "weeks": {}}
    for rel in range(0, max_rel + 1):
        cnt = sum(1 for uid in cohort_users[c] if rel in user_active_rel_weeks[uid])
        row["weeks"][rel] = cnt
    retention[c] = row

# ----------------------------------------------------------------------
# Write expected-results.md (plain prose, no em-dashes)
# ----------------------------------------------------------------------
def pct(x):
    return f"{x:.1f}%"

lines = []
lines.append("# Expected Results")
lines.append("")
lines.append("All values below were computed directly from the generated data files in this folder, not estimated. Recompute them with your own SQL to check student answers.")
lines.append("")
lines.append("## Row counts")
lines.append("")
lines.append(f"- users: {len(users)}")
lines.append(f"- sessions: {len(sessions)}")
lines.append(f"- events: {len(events)}")
lines.append("")
lines.append("## Topic completion rate")
lines.append("")
lines.append("Definition: distinct sessions that contain a topic_completed event (the learner finished a topic), divided by the total number of distinct sessions. This is the activation metric for this product.")
lines.append("")
lines.append(f"- distinct sessions with topic_completed: {n_cmp}")
lines.append(f"- total distinct sessions: {total_sessions}")
lines.append(f"- topic completion rate: {n_cmp} / {total_sessions} = {pct(activation_rate*100)} ({activation_rate:.4f})")
lines.append("")
lines.append("## Funnel")
lines.append("")
lines.append("The funnel is the learner journey: open a topic, use its interactive aid, then complete the topic. Each step counts the number of distinct sessions that reached that step (had at least one event of that type). Conversion is step over previous step.")
lines.append("")
lines.append("| Step | Distinct sessions | Step-to-step conversion |")
lines.append("| --- | --- | --- |")
lines.append(f"| topic_opened | {n_pv} | (entry) |")
lines.append(f"| interactive_used | {n_sel} | {pct(conv_sel)} of topic_opened |")
lines.append(f"| topic_completed | {n_cmp} | {pct(conv_cmp)} of interactive_used |")
lines.append("")
lines.append(f"Note: {total_sessions - distinct_sessions_any_event} session(s) have no events at all and therefore do not appear in any funnel step. These are an intentional edge case.")
lines.append("")
lines.append("## Window functions: ROW_NUMBER, RANK, DENSE_RANK")
lines.append("")
lines.append(f"Example session_id = {example_sid}, ordered by occurred_at. This session contains two events that share the identical occurred_at, so ROW_NUMBER, RANK, and DENSE_RANK diverge.")
lines.append("")
lines.append("Reference query:")
lines.append("")
lines.append("```sql")
lines.append("SELECT")
lines.append("    event_id,")
lines.append("    event,")
lines.append("    occurred_at,")
lines.append("    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY occurred_at) AS rn,")
lines.append("    RANK()       OVER (PARTITION BY session_id ORDER BY occurred_at) AS rnk,")
lines.append("    DENSE_RANK() OVER (PARTITION BY session_id ORDER BY occurred_at) AS dns")
lines.append(f"FROM events")
lines.append(f"WHERE session_id = {example_sid}")
lines.append("ORDER BY occurred_at, event_id;")
lines.append("```")
lines.append("")
lines.append("Note on ties: ROW_NUMBER assigns a distinct number to each tied row, so the exact rn for the two tied rows depends on the tie-break the engine uses. The values below break ties by event_id for determinism. RANK and DENSE_RANK are deterministic regardless of tie-break.")
lines.append("")
lines.append("| occurred_at | event | event_id | ROW_NUMBER | RANK | DENSE_RANK |")
lines.append("| --- | --- | --- | --- | --- | --- |")
for i, e in enumerate(example_events):
    lines.append(f"| {e['occurred_at']} | {e['event']} | {e['event_id']} | {row_number[i]} | {rank[i]} | {dense_rank[i]} |")
lines.append("")
lines.append("## Cumulative sessions by day")
lines.append("")
lines.append("Sessions counted on their started_at date, with a running total ordered by date.")
lines.append("")
lines.append("| date | sessions that day | cumulative sessions |")
lines.append("| --- | --- | --- |")
for d, c, run in cumulative:
    lines.append(f"| {d} | {c} | {run} |")
lines.append("")
lines.append("## Cohort retention grid")
lines.append("")
lines.append("Rows are signup-week cohorts (week 0 is the first signup week). Columns are weeks since signup. Each cell is the number of users in that cohort who had at least one session during that relative week. Week 0 counts users active in the same week they signed up.")
lines.append("")
header = "| Cohort (signup week) | Cohort size | " + " | ".join(f"W{w}" for w in range(0, max_rel + 1)) + " |"
lines.append(header)
lines.append("| --- | --- | " + " | ".join("---" for _ in range(0, max_rel + 1)) + " |")
for c in cohorts_sorted:
    row = retention[c]
    cells = " | ".join(str(row["weeks"][w]) for w in range(0, max_rel + 1))
    lines.append(f"| Week {c} | {row['size']} | {cells} |")
lines.append("")
lines.append("The same grid as retention percentages of each cohort:")
lines.append("")
lines.append(header)
lines.append("| --- | --- | " + " | ".join("---" for _ in range(0, max_rel + 1)) + " |")
for c in cohorts_sorted:
    row = retention[c]
    size = row["size"]
    cells = " | ".join((f"{(row['weeks'][w]/size*100):.0f}%" if size else "0%") for w in range(0, max_rel + 1))
    lines.append(f"| Week {c} | {size} | {cells} |")
lines.append("")

with open(f"{OUTPUT_DIR}/expected-results.md", "w") as f:
    f.write("\n".join(lines))

# ----------------------------------------------------------------------
# Console summary (also used for verification)
# ----------------------------------------------------------------------
print("SEED:", SEED)
print("users:", len(users))
print("sessions:", len(sessions))
print("events:", len(events))
print("users with zero sessions:", sorted(set(u['user_id'] for u in users) - set(s['user_id'] for s in sessions)))
print("sessions with zero events:", sorted(zero_event_session_ids))
print("identical-timestamp session_id:", identical_ts_session_id)
print("funnel topic_opened/select/compare:", n_pv, n_sel, n_cmp)
print("activation rate:", round(activation_rate, 4))
print("conv select%:", round(conv_sel, 1), "conv compare%:", round(conv_cmp, 1))
print("cohorts:", cohorts_sorted, "max rel week:", max_rel)
