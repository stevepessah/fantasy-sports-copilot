// Script to set up a league from Yahoo data (requires YAHOO_ACCESS_TOKEN env var)
// Usage: YAHOO_ACCESS_TOKEN=<token> npx tsx scripts/createLeagueNow.ts
import { setupBaseballLeague } from '../lib/setupBaseballLeague'

async function main() {
  const accessToken = process.env.YAHOO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('❌ YAHOO_ACCESS_TOKEN environment variable is required.')
    console.error('   Run: YAHOO_ACCESS_TOKEN=<your_token> npx tsx scripts/createLeagueNow.ts')
    process.exit(1)
  }

  const result = await setupBaseballLeague(accessToken)

  console.log('\n✅ League Loaded from Yahoo!')
  console.log(`\nLeague ID: ${result.league.id}`)
  console.log(`League Name: ${result.league.name}`)
  console.log(`Sport: ${result.league.sport}`)
  console.log(`Scoring: ${result.league.scoringType}`)
  console.log(`Status: ${result.league.status}`)
  console.log(`Season: ${result.league.season}`)
  console.log(`\nTeams (${result.teams.length}):`)
  result.teams.forEach((team, index) => {
    console.log(`  ${index + 1}. ${team.name} — ${team.wins}W ${team.losses}L`)
  })
  console.log(`\nYahoo League Key: ${result.yahooLeagueKey}`)
  console.log(`\n🎉 League data is ready!`)
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
