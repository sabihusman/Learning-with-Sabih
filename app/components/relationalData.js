// Small, readable slices of the shared users and sessions tables for the intro
// "relational model" topic. Chosen so the foreign-key relationship is easy to see:
// four users, five sessions, with user 31 owning two sessions (a one-to-many link)
// so clicking a user can highlight more than one session.
import { users, sessions } from './sqlData'

const USER_IDS = [5, 14, 20, 31]
const SESSION_IDS = [1, 2, 3, 4, 14]

const findById = (rows, key, id) => rows.find((r) => r[key] === id)

export const USERS = USER_IDS.map((id) => {
  const { user_id, country, plan } = findById(users, 'user_id', id)
  return { user_id, country, plan }
})

export const SESSIONS = SESSION_IDS.map((id) => {
  const { session_id, user_id, started_at } = findById(sessions, 'session_id', id)
  return { session_id, user_id, started_at: started_at.slice(0, 10) } // date only keeps the cell narrow
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
