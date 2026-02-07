// Script to directly create the league (can be run with ts-node or tsx)
import { setupBaseballLeague } from '../lib/setupBaseballLeague'

const result = setupBaseballLeague()

console.log('\n✅ League Created Successfully!')
console.log(`\nLeague ID: ${result.league.id}`)
console.log(`League Name: ${result.league.name}`)
console.log(`Sport: ${result.league.sport}`)
console.log(`Scoring: ${result.league.scoringType}`)
console.log(`Status: ${result.league.status}`)
console.log(`\nTeams (${result.teams.length}):`)
result.teams.forEach((team, index) => {
  console.log(`  ${index + 1}. ${team.name} (${team.id})`)
})
console.log(`\nSchedule:`)
console.log(`  Regular Season: Weeks 1-${result.regularSeasonWeeks}`)
console.log(`  Playoffs: Weeks ${result.regularSeasonWeeks + 1}-${result.totalWeeks}`)
console.log(`  Total Matchups Created: ${result.matchups.length}`)
console.log(`\n🎉 Your league is ready for the draft!`)
