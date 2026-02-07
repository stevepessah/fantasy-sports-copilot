// Script to create a 12-team head-to-head baseball league with full schedule
import { League, Team, Matchup } from '@/types'
import { leagueDB, teamDB, matchupDB, rosterDB } from '@/lib/db'

const TEAM_NAMES = [
  'Smithtown Scallywags',
  'Andino Smiles',
  'Better than Chris',
  'Ellytric Corbin Copies',
  'Goshen Dusters',
  'Isotopes',
  'Lloyd Harbor Llamas',
  'Lizards',
  'Schwarberless',
  'Yeah Jeets !',
  'Yordan Brand',
  'Top Gunnar',
]

const REGULAR_SEASON_WEEKS = 22
const PLAYOFF_WEEKS = 3
const TOTAL_WEEKS = 25

// Generate round-robin schedule for 12 teams
// Uses a standard round-robin tournament algorithm
function generateSchedule(numTeams: number, numWeeks: number): number[][] {
  const schedule: number[][] = []
  const teams = Array.from({ length: numTeams }, (_, i) => i)
  
  // For round-robin: fix team 0, rotate others
  for (let week = 0; week < numWeeks; week++) {
    const weekMatchups: number[] = []
    
    // Create rotation: team 0 stays fixed, others rotate
    const rotation = week % (numTeams - 1)
    const rotated = [
      0, // Team 0 stays fixed
      ...teams.slice(1).map((_, idx) => {
        const newIdx = (idx + rotation) % (numTeams - 1)
        return teams[1 + newIdx]
      })
    ]
    
    // Pair teams: first with last, second with second-to-last, etc.
    for (let i = 0; i < numTeams / 2; i++) {
      weekMatchups.push(rotated[i], rotated[numTeams - 1 - i])
    }
    
    schedule.push(weekMatchups)
  }
  
  return schedule
}

export function createBaseballLeague() {
  // Create league
  const league: League = {
    id: `league_baseball_${Date.now()}`,
    name: 'Fantasy Baseball League 2025',
    commissionerId: 'commissioner_1',
    sport: 'baseball',
    type: 'redraft',
    numTeams: 12,
    scoringType: 'head-to-head',
    draftType: 'snake',
    status: 'setup',
    createdAt: new Date().toISOString(),
    period: 1, // Start at week 1
    season: 2025,
  }

  const createdLeague = leagueDB.create(league)
  console.log(`Created league: ${createdLeague.id}`)

  // Create teams
  const teams: Team[] = []
  TEAM_NAMES.forEach((name, index) => {
    const team: Team = {
      id: `team_${createdLeague.id}_${index + 1}`,
      leagueId: createdLeague.id,
      ownerId: `owner_${index + 1}`,
      name: name,
      draftPosition: index + 1,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    }
    teamDB.create(team)
    teams.push(team)
    
    // Create empty roster for each team
    rosterDB.create({
      teamId: team.id,
      players: [],
    })
    
    console.log(`Created team: ${team.name} (${team.id})`)
  })

  // Generate schedule
  const schedule = generateSchedule(12, TOTAL_WEEKS)

  // Create matchups for all weeks
  for (let week = 1; week <= TOTAL_WEEKS; week++) {
    const weekIndex = week - 1
    const weekMatchups = schedule[weekIndex]
    
    const isPlayoff = week > REGULAR_SEASON_WEEKS
    
    for (let i = 0; i < weekMatchups.length; i += 2) {
      const team1Index = weekMatchups[i]
      const team2Index = weekMatchups[i + 1]
      
      if (team1Index === undefined || team2Index === undefined) continue
      
      const team1 = teams[team1Index]
      const team2 = teams[team2Index]
      
      const matchup: Matchup = {
        id: `matchup_${createdLeague.id}_week${week}_${i / 2}`,
        leagueId: createdLeague.id,
        period: week, // Use period for baseball weeks
        team1Id: team1.id,
        team2Id: team2.id,
        team1Score: 0,
        team2Score: 0,
        status: 'upcoming',
      }
      
      matchupDB.create(matchup)
      console.log(`Week ${week}${isPlayoff ? ' (Playoffs)' : ''}: ${team1.name} vs ${team2.name}`)
    }
  }

  console.log(`\n✓ Created league with ${teams.length} teams and ${TOTAL_WEEKS} weeks of matchups`)
  console.log(`  Regular season: Weeks 1-${REGULAR_SEASON_WEEKS}`)
  console.log(`  Playoffs: Weeks ${REGULAR_SEASON_WEEKS + 1}-${TOTAL_WEEKS}`)
  
  return {
    league: createdLeague,
    teams,
    totalWeeks: TOTAL_WEEKS,
    regularSeasonWeeks: REGULAR_SEASON_WEEKS,
    playoffWeeks: PLAYOFF_WEEKS,
  }
}

// Run if executed directly
if (require.main === module) {
  createBaseballLeague()
}
