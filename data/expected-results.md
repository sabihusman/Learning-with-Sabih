# Expected Results

All values below were computed directly from the generated data files in this folder, not estimated. Recompute them with your own SQL to check student answers.

## Row counts

- users: 50
- sessions: 146
- events: 383

## Topic completion rate

Definition: distinct sessions that contain a topic_completed event (the learner finished a topic), divided by the total number of distinct sessions. This is the activation metric for this product.

- distinct sessions with topic_completed: 45
- total distinct sessions: 146
- topic completion rate: 45 / 146 = 30.8% (0.3082)

## Funnel

The funnel is the learner journey: open a topic, use its interactive aid, then complete the topic. Each step counts the number of distinct sessions that reached that step (had at least one event of that type). Conversion is step over previous step.

| Step | Distinct sessions | Step-to-step conversion |
| --- | --- | --- |
| topic_opened | 143 | (entry) |
| interactive_used | 77 | 53.8% of topic_opened |
| topic_completed | 45 | 58.4% of interactive_used |

Note: 3 session(s) have no events at all and therefore do not appear in any funnel step. These are an intentional edge case.

## Window functions: ROW_NUMBER, RANK, DENSE_RANK

Example session_id = 1, ordered by occurred_at. This session contains two events that share the identical occurred_at, so ROW_NUMBER, RANK, and DENSE_RANK diverge.

Reference query:

```sql
SELECT
    event_id,
    event,
    occurred_at,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY occurred_at) AS rn,
    RANK()       OVER (PARTITION BY session_id ORDER BY occurred_at) AS rnk,
    DENSE_RANK() OVER (PARTITION BY session_id ORDER BY occurred_at) AS dns
FROM events
WHERE session_id = 1
ORDER BY occurred_at, event_id;
```

Note on ties: ROW_NUMBER assigns a distinct number to each tied row, so the exact rn for the two tied rows depends on the tie-break the engine uses. The values below break ties by event_id for determinism. RANK and DENSE_RANK are deterministic regardless of tie-break.

| occurred_at | event | event_id | ROW_NUMBER | RANK | DENSE_RANK |
| --- | --- | --- | --- | --- | --- |
| 2025-01-10 07:38:02 | topic_opened | 1 | 1 | 1 | 1 |
| 2025-01-10 07:38:26 | topic_opened | 2 | 2 | 2 | 2 |
| 2025-01-10 07:38:26 | interactive_used | 3 | 3 | 2 | 2 |
| 2025-01-10 07:39:18 | interactive_used | 4 | 4 | 4 | 3 |
| 2025-01-10 07:40:06 | topic_completed | 5 | 5 | 5 | 4 |
| 2025-01-10 07:40:46 | topic_completed | 6 | 6 | 6 | 5 |

## Cumulative sessions by day

Sessions counted on their started_at date, with a running total ordered by date.

| date | sessions that day | cumulative sessions |
| --- | --- | --- |
| 2025-01-10 | 1 | 1 |
| 2025-01-11 | 1 | 2 |
| 2025-01-12 | 3 | 5 |
| 2025-01-13 | 1 | 6 |
| 2025-01-15 | 1 | 7 |
| 2025-01-16 | 3 | 10 |
| 2025-01-17 | 3 | 13 |
| 2025-01-19 | 1 | 14 |
| 2025-01-20 | 3 | 17 |
| 2025-01-21 | 1 | 18 |
| 2025-01-23 | 1 | 19 |
| 2025-01-26 | 3 | 22 |
| 2025-01-29 | 3 | 25 |
| 2025-01-30 | 4 | 29 |
| 2025-02-01 | 3 | 32 |
| 2025-02-02 | 2 | 34 |
| 2025-02-03 | 2 | 36 |
| 2025-02-05 | 1 | 37 |
| 2025-02-06 | 1 | 38 |
| 2025-02-07 | 3 | 41 |
| 2025-02-08 | 4 | 45 |
| 2025-02-09 | 1 | 46 |
| 2025-02-10 | 5 | 51 |
| 2025-02-11 | 1 | 52 |
| 2025-02-12 | 1 | 53 |
| 2025-02-13 | 3 | 56 |
| 2025-02-14 | 4 | 60 |
| 2025-02-15 | 3 | 63 |
| 2025-02-16 | 2 | 65 |
| 2025-02-17 | 3 | 68 |
| 2025-02-18 | 1 | 69 |
| 2025-02-19 | 2 | 71 |
| 2025-02-20 | 1 | 72 |
| 2025-02-21 | 2 | 74 |
| 2025-02-22 | 2 | 76 |
| 2025-02-23 | 5 | 81 |
| 2025-02-24 | 3 | 84 |
| 2025-02-25 | 1 | 85 |
| 2025-02-26 | 1 | 86 |
| 2025-02-27 | 1 | 87 |
| 2025-02-28 | 2 | 89 |
| 2025-03-01 | 2 | 91 |
| 2025-03-02 | 5 | 96 |
| 2025-03-03 | 2 | 98 |
| 2025-03-04 | 5 | 103 |
| 2025-03-06 | 3 | 106 |
| 2025-03-07 | 1 | 107 |
| 2025-03-08 | 1 | 108 |
| 2025-03-09 | 3 | 111 |
| 2025-03-11 | 2 | 113 |
| 2025-03-12 | 2 | 115 |
| 2025-03-13 | 3 | 118 |
| 2025-03-14 | 1 | 119 |
| 2025-03-15 | 2 | 121 |
| 2025-03-16 | 2 | 123 |
| 2025-03-18 | 2 | 125 |
| 2025-03-19 | 2 | 127 |
| 2025-03-20 | 1 | 128 |
| 2025-03-23 | 1 | 129 |
| 2025-03-24 | 3 | 132 |
| 2025-03-26 | 1 | 133 |
| 2025-03-27 | 1 | 134 |
| 2025-03-28 | 1 | 135 |
| 2025-03-29 | 1 | 136 |
| 2025-03-31 | 1 | 137 |
| 2025-04-01 | 2 | 139 |
| 2025-04-02 | 1 | 140 |
| 2025-04-05 | 1 | 141 |
| 2025-04-07 | 1 | 142 |
| 2025-04-09 | 1 | 143 |
| 2025-04-10 | 1 | 144 |
| 2025-04-12 | 1 | 145 |
| 2025-04-16 | 1 | 146 |

## Cohort retention grid

Rows are signup-week cohorts (week 0 is the first signup week). Columns are weeks since signup. Each cell is the number of users in that cohort who had at least one session during that relative week. Week 0 counts users active in the same week they signed up.

| Cohort (signup week) | Cohort size | W0 | W1 | W2 | W3 | W4 | W5 | W6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Week 0 | 6 | 6 | 2 | 3 | 1 | 2 | 2 | 0 |
| Week 1 | 7 | 7 | 0 | 2 | 0 | 2 | 3 | 1 |
| Week 2 | 4 | 4 | 2 | 2 | 1 | 0 | 1 | 0 |
| Week 3 | 9 | 8 | 3 | 1 | 0 | 3 | 1 | 0 |
| Week 4 | 5 | 5 | 1 | 2 | 1 | 2 | 2 | 2 |
| Week 5 | 6 | 6 | 2 | 2 | 1 | 3 | 2 | 2 |
| Week 6 | 6 | 4 | 2 | 2 | 0 | 2 | 1 | 1 |
| Week 7 | 7 | 6 | 3 | 3 | 2 | 1 | 2 | 2 |

The same grid as retention percentages of each cohort:

| Cohort (signup week) | Cohort size | W0 | W1 | W2 | W3 | W4 | W5 | W6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Week 0 | 6 | 100% | 33% | 50% | 17% | 33% | 33% | 0% |
| Week 1 | 7 | 100% | 0% | 29% | 0% | 29% | 43% | 14% |
| Week 2 | 4 | 100% | 50% | 50% | 25% | 0% | 25% | 0% |
| Week 3 | 9 | 89% | 33% | 11% | 0% | 33% | 11% | 0% |
| Week 4 | 5 | 100% | 20% | 40% | 20% | 40% | 40% | 40% |
| Week 5 | 6 | 100% | 33% | 33% | 17% | 50% | 33% | 33% |
| Week 6 | 6 | 67% | 33% | 33% | 0% | 33% | 17% | 17% |
| Week 7 | 7 | 86% | 43% | 43% | 29% | 14% | 29% | 29% |
