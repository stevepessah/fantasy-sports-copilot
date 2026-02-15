// Helper functions to search for players in Yahoo rosters

import { YahooFantasyAPI } from './api'
import { ParsedRosterPlayer, parseRosterXML, ParsedTeam } from './xmlParser'

export interface PlayerOwnership {
  player: ParsedRosterPlayer
  ownershipStatus: 'free_agent' | 'taken'
  owningTeam?: ParsedTeam
}

/**
 * Get player ownership information (who owns the player in the league)
 */
export async function getPlayerOwnership(
  api: YahooFantasyAPI,
  leagueKey: string,
  playerName: string
): Promise<PlayerOwnership | null> {
  try {
    // Get all teams in the league
    const { teams } = await api.getLeagueTeams(leagueKey)
    
    // Search through each team's roster
    for (const team of teams) {
      const { players } = await api.getTeamRoster(team.team_key)
      
      // Try to find a matching player
      const normalizedQuery = playerName.toLowerCase().trim()
      const queryParts = normalizedQuery.split(/\s+/).filter(Boolean)
      
      const found = players.find((player) => {
        const fullName = player.name.full.toLowerCase()
        const firstName = player.name.first.toLowerCase()
        const lastName = player.name.last.toLowerCase()
        
        // Exact match
        if (fullName === normalizedQuery) return true
        
        // Check if all query parts match
        if (queryParts.length >= 2) {
          const firstMatches = firstName.includes(queryParts[0]) || queryParts[0].includes(firstName)
          const lastMatches = lastName.includes(queryParts[queryParts.length - 1]) || queryParts[queryParts.length - 1].includes(lastName)
          if (firstMatches && lastMatches) return true
        }
        
        // Partial matches
        return (
          fullName.includes(normalizedQuery) ||
          normalizedQuery.includes(fullName) ||
          `${firstName} ${lastName}`.includes(normalizedQuery) ||
          lastName.includes(normalizedQuery) ||
          (queryParts.length === 2 &&
            (firstName.includes(queryParts[0]) || queryParts[0].includes(firstName)) &&
            (lastName.includes(queryParts[1]) || queryParts[1].includes(lastName)))
        )
      })
      
      if (found) {
        return {
          player: found,
          ownershipStatus: 'taken',
          owningTeam: team
        }
      }
    }
    
    // If not found in any roster, check free agents
    const freeAgent = await searchPlayerInFreeAgents(api, leagueKey, playerName)
    if (freeAgent) {
      return {
        player: freeAgent,
        ownershipStatus: 'free_agent'
      }
    }
    
    return null
  } catch (error) {
    console.error('Error getting player ownership:', error)
    return null
  }
}

/**
 * Look up TWO players in a single pass through all rosters + free agents.
 * Avoids the rate-limit / timeout problems of running two getPlayerOwnership
 * calls in parallel (each of which iterates through every team).
 */
export async function getPlayerOwnershipPair(
  api: YahooFantasyAPI,
  leagueKey: string,
  nameA: string,
  nameB: string,
): Promise<[PlayerOwnership | null, PlayerOwnership | null]> {
  let resultA: PlayerOwnership | null = null
  let resultB: PlayerOwnership | null = null

  const matchesName = (player: ParsedRosterPlayer, query: string): boolean => {
    const normalizedQuery = query.toLowerCase().trim()
    const queryParts = normalizedQuery.split(/\s+/).filter(Boolean)
    const fullName = player.name.full.toLowerCase()
    const firstName = player.name.first.toLowerCase()
    const lastName = player.name.last.toLowerCase()

    if (fullName === normalizedQuery) return true
    if (queryParts.length >= 2) {
      const firstMatches = firstName.includes(queryParts[0]) || queryParts[0].includes(firstName)
      const lastMatches = lastName.includes(queryParts[queryParts.length - 1]) || queryParts[queryParts.length - 1].includes(lastName)
      if (firstMatches && lastMatches) return true
    }
    return (
      fullName.includes(normalizedQuery) ||
      normalizedQuery.includes(fullName) ||
      `${firstName} ${lastName}`.includes(normalizedQuery) ||
      lastName.includes(normalizedQuery) ||
      (queryParts.length === 2 &&
        (firstName.includes(queryParts[0]) || queryParts[0].includes(firstName)) &&
        (lastName.includes(queryParts[1]) || queryParts[1].includes(lastName)))
    )
  }

  try {
    // Single fetch of all teams
    const { teams } = await api.getLeagueTeams(leagueKey)

    // Walk each roster ONCE, checking for both players
    for (const team of teams) {
      if (resultA && resultB) break
      const { players } = await api.getTeamRoster(team.team_key)
      for (const p of players) {
        if (!resultA && matchesName(p, nameA)) {
          resultA = { player: p, ownershipStatus: 'taken', owningTeam: team }
        }
        if (!resultB && matchesName(p, nameB)) {
          resultB = { player: p, ownershipStatus: 'taken', owningTeam: team }
        }
        if (resultA && resultB) break
      }
    }

    // For any still-missing player, check free agents (one at a time to stay under rate limits)
    if (!resultA) {
      const fa = await searchPlayerInFreeAgents(api, leagueKey, nameA)
      if (fa) resultA = { player: fa, ownershipStatus: 'free_agent' }
    }
    if (!resultB) {
      const fb = await searchPlayerInFreeAgents(api, leagueKey, nameB)
      if (fb) resultB = { player: fb, ownershipStatus: 'free_agent' }
    }
  } catch (error) {
    console.error('Error in getPlayerOwnershipPair:', error)
  }

  return [resultA, resultB]
}

/**
 * Search for a player across all teams in a league
 */
export async function searchPlayerInLeague(
  api: YahooFantasyAPI,
  leagueKey: string,
  playerName: string
): Promise<ParsedRosterPlayer | null> {
  try {
    // Get all teams in the league
    const { teams } = await api.getLeagueTeams(leagueKey)
    
    // Search through each team's roster
    for (const team of teams) {
      const { players } = await api.getTeamRoster(team.team_key)
      
      // Try to find a matching player
      const normalizedQuery = playerName.toLowerCase().trim()
      const queryParts = normalizedQuery.split(/\s+/).filter(Boolean)
      
      const found = players.find((player) => {
        const fullName = player.name.full.toLowerCase()
        const firstName = player.name.first.toLowerCase()
        const lastName = player.name.last.toLowerCase()
        
        // Exact match
        if (fullName === normalizedQuery) return true
        
        // Check if all query parts match
        if (queryParts.length >= 2) {
          const firstMatches = firstName.includes(queryParts[0]) || queryParts[0].includes(firstName)
          const lastMatches = lastName.includes(queryParts[queryParts.length - 1]) || queryParts[queryParts.length - 1].includes(lastName)
          if (firstMatches && lastMatches) return true
        }
        
        // Partial matches
        return (
          fullName.includes(normalizedQuery) ||
          normalizedQuery.includes(fullName) ||
          `${firstName} ${lastName}`.includes(normalizedQuery) ||
          lastName.includes(normalizedQuery) ||
          (queryParts.length === 2 &&
            (firstName.includes(queryParts[0]) || queryParts[0].includes(firstName)) &&
            (lastName.includes(queryParts[1]) || queryParts[1].includes(lastName)))
        )
      })
      
      if (found) {
        return found
      }
    }
    
    return null
  } catch (error) {
    console.error('Error searching for player in league:', error)
    return null
  }
}

/**
 * Search for a player in available players (free agents)
 */
export async function searchPlayerInFreeAgents(
  api: YahooFantasyAPI,
  leagueKey: string,
  playerName: string,
  maxPages: number = 10  // Increased from 5 to search more players
): Promise<ParsedRosterPlayer | null> {
  try {
    const normalizedQuery = playerName.toLowerCase().trim()
    
    // Search through multiple pages of free agents
    for (let page = 0; page < maxPages; page++) {
      const start = page * 25
      const response = await api.getPlayers(leagueKey, { start, count: 25 })
      
      // Parse the players from XML
      if (response.raw) {
        const players = parseRosterXML(response.raw)
        
        const queryParts = normalizedQuery.split(/\s+/).filter(Boolean)
        
        const found = players.find((player) => {
          const fullName = player.name.full.toLowerCase()
          const firstName = player.name.first.toLowerCase()
          const lastName = player.name.last.toLowerCase()
          
          // Exact match
          if (fullName === normalizedQuery) return true
          
          // Check if all query parts match
          if (queryParts.length >= 2) {
            const firstMatches = firstName.includes(queryParts[0]) || queryParts[0].includes(firstName)
            const lastMatches = lastName.includes(queryParts[queryParts.length - 1]) || queryParts[queryParts.length - 1].includes(lastName)
            if (firstMatches && lastMatches) return true
          }
          
          // Partial matches
          return (
            fullName.includes(normalizedQuery) ||
            normalizedQuery.includes(fullName) ||
            `${firstName} ${lastName}`.includes(normalizedQuery) ||
            lastName.includes(normalizedQuery) ||
            (queryParts.length === 2 &&
              (firstName.includes(queryParts[0]) || queryParts[0].includes(firstName)) &&
              (lastName.includes(queryParts[1]) || queryParts[1].includes(lastName)))
          )
        })
        
        if (found) {
          return found
        }
        
        // If we got fewer than 25 players, we've reached the end
        if (players.length < 25) {
          break
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error searching for player in free agents:', error)
    return null
  }
}
