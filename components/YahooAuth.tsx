'use client'

import { useYahooAuth } from '@/contexts/YahooAuthContext'
import { useLeague } from '@/contexts/LeagueContext'
import YahooTeams from './YahooTeams'

export default function YahooAuth() {
  const { isAuthenticated, isLoading, mutate } = useYahooAuth()
  const { leagues, isLoading: leaguesLoading, error: leaguesError, errorCode: leaguesErrorCode, selectedLeagueKey, setSelectedLeagueKey } = useLeague()

  const handleConnect = () => {
    window.location.href = '/api/yahoo/auth'
  }

  const handleDisconnect = async () => {
    try {
      await fetch('/api/yahoo/disconnect', { method: 'POST' })
      mutate()
    } catch (error) {
      console.error('Error disconnecting:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="text-sm text-slate-400">
        Checking Yahoo connection...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isAuthenticated ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-slate-300">Connected to Yahoo</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-slate-400 hover:text-slate-300 underline"
            >
              Disconnect
            </button>
          </div>
          
          {leaguesLoading ? (
            <div className="text-xs text-slate-400">Loading leagues...</div>
          ) : leaguesError ? (
            leaguesErrorCode === 'yahoo_not_authorized' ? (
              // App-level Yahoo approval gate: reconnecting cannot fix this.
              <div className="space-y-1">
                <div className="text-xs text-amber-400">
                  Yahoo hasn&apos;t approved this app for Fantasy API access, so league
                  data can&apos;t load. This is an app approval issue with Yahoo, not your
                  login &mdash; reconnecting won&apos;t help.
                </div>
                <a
                  href="https://sports.yahoo.com/developer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300 underline"
                >
                  Request Fantasy API access
                </a>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs text-red-400">
                  {leaguesError || "Couldn't load your leagues."}
                </div>
                <button
                  onClick={handleConnect}
                  className="text-xs text-purple-400 hover:text-purple-300 underline"
                >
                  Reconnect Yahoo
                </button>
              </div>
            )
          ) : leagues.length > 0 ? (
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block">Select League:</label>
              <select
                value={selectedLeagueKey || ''}
                onChange={(e) => setSelectedLeagueKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {leagues.map((league) => (
                  <option key={league.league_key} value={league.league_key}>
                    {league.name} ({league.season} {league.game_code === 'mlb' ? '⚾' : '🏈'})
                    {league.is_finished === '1' ? ' (Finished)' : ''}
                  </option>
                ))}
              </select>
              {selectedLeagueKey && (
                <div className="text-xs text-slate-400 mt-1">
                  {leagues.find(l => l.league_key === selectedLeagueKey)?.num_teams} teams
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400">No leagues found</div>
          )}
          
          {selectedLeagueKey && (
            <div className="border-t border-slate-700 pt-3 mt-3">
              <YahooTeams leagueKey={selectedLeagueKey} />
            </div>
          )}
        </>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors text-sm"
        >
          Connect Yahoo Fantasy League
        </button>
      )}
    </div>
  )
}
