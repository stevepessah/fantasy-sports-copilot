// Helper functions to search for players in Yahoo rosters

import { YahooFantasyAPI } from './api'
import { ParsedRosterPlayer, parseRosterXML } from './xmlParser'

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
      const found = players.find((player) => {
        const fullName = player.name.full.toLowerCase()
        const firstName = player.name.first.toLowerCase()
        const lastName = player.name.last.toLowerCase()
        
        // Check various name combinations
        return (
          fullName.includes(normalizedQuery) ||
          `${firstName} ${lastName}`.includes(normalizedQuery) ||
          lastName.includes(normalizedQuery) ||
          (normalizedQuery.split(' ').length === 2 &&
            firstName.includes(normalizedQuery.split(' ')[0]) &&
            lastName.includes(normalizedQuery.split(' ')[1]))
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
  maxPages: number = 5
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
        
        const found = players.find((player) => {
          const fullName = player.name.full.toLowerCase()
          const firstName = player.name.first.toLowerCase()
          const lastName = player.name.last.toLowerCase()
          
          return (
            fullName.includes(normalizedQuery) ||
            `${firstName} ${lastName}`.includes(normalizedQuery) ||
            lastName.includes(normalizedQuery) ||
            (normalizedQuery.split(' ').length === 2 &&
              firstName.includes(normalizedQuery.split(' ')[0]) &&
              lastName.includes(normalizedQuery.split(' ')[1]))
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
