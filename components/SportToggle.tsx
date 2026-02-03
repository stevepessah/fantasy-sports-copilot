'use client'

import { Sport } from '@/types'
import { formatSportName } from '@/lib/sports'

interface SportToggleProps {
  currentSport: Sport
  onSportChange: (sport: Sport) => void
}

export default function SportToggle({ currentSport, onSportChange }: SportToggleProps) {
  return (
    <div className="flex items-center gap-2 mb-4 p-2 bg-slate-800 rounded-lg">
      <span className="text-sm text-slate-400 mr-2">Sport:</span>
      <button
        onClick={() => onSportChange('football')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          currentSport === 'football'
            ? 'bg-primary-600 text-white'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        🏈 Football
      </button>
      <button
        onClick={() => onSportChange('baseball')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          currentSport === 'baseball'
            ? 'bg-primary-600 text-white'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        ⚾ Baseball
      </button>
    </div>
  )
}
