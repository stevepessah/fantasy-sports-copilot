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
      const response = await api.getPlayers(leagueKey, start, 25)
      
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
