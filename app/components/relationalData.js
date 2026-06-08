// Small, readable slices of the shared users and sessions tables for the intro
// "relational model" topic. Chosen so the foreign-key relationship is easy to see:
// four users, five sessions, with user 31 owning two sessions (a one-to-many link)
// so clicking a user can highlight more than one session.
import { users, sessions } from './sqlData'

const USER_IDS = [5, 14, 20, 31]
const SESSION_IDS = [1, 2, 3, 4, 14]

export const USERS = USER_IDS.map((id) => {
  const u = users.find((x) => x.user_id === id)
  return { user_id: u.user_id, country: u.country, plan: u.plan }
})

export const SESSIONS = SESSION_IDS.map((id) => {
  const s = sessions.find((x) => x.session_id === id)
  // date only keeps the cell narrow and readable
  return { session_id: s.session_id, user_id: s.user_id, started_at: s.started_at.split(' ')[0] }
})

// Column definitions, including which column is the primary key (PK) and which is
// the foreign key (FK) pointing back to users.user_id.
export const USER_COLS = [
  { key: 'user_id', label: 'user_id', role: 'PK', w: 62 },
  { key: 'country', label: 'country', w: 64 },
  { key: 'plan', label: 'plan', w: 54 },
]

export const SESSION_COLS = [
  { key: 'session_id', label: 'session_id', role: 'PK', w: 82 },
  { key: 'user_id', label: 'user_id', role: 'FK', w: 62 },
  { key: 'started_at', label: 'started_at', w: 96 },
]
