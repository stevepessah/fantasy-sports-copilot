// Simple in-memory login log
// Persists as long as the serverless function instance is warm.
// For permanent persistence, swap this with Vercel KV or a database.

export interface LoginEntry {
  guid: string
  timestamp: string
}

const logins: LoginEntry[] = []

export function recordLogin(guid: string) {
  logins.push({
    guid,
    timestamp: new Date().toISOString(),
  })
}

export function getLogins(): LoginEntry[] {
  return logins
}
