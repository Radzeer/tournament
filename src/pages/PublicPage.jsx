import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ScoreBoard from '../components/ScoreBoard.jsx'
import StandingsTable from '../components/StandingsTable.jsx'

export default function PublicPage() {
  const [matches, setMatches] = useState([])
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  const loadMatches = useCallback(async () => {
    const { data } = await supabase
      .from('match_results')
      .select('*')
      .order('scheduled_at', { ascending: true })
    setMatches(data ?? [])
  }, [])

  const loadStandings = useCallback(async () => {
    const { data } = await supabase.from('standings').select('*')
    setStandings(data ?? [])
  }, [])

  useEffect(() => {
    Promise.all([loadMatches(), loadStandings()]).then(() => setLoading(false))

    // Minden új gól/büntető azonnal frissíti az állást és a tabellát,
    // a néző oldalán F5 nélkül.
    const channel = supabase
      .channel('public-scores')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_events' },
        () => {
          loadMatches()
          loadStandings()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        () => loadMatches()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadMatches, loadStandings])

  if (loading) return <p className="hint page">Betöltés…</p>

  const live = matches.filter((m) => m.status === 'live')
  const upcoming = matches.filter((m) => m.status === 'upcoming')
  const finished = matches.filter((m) => m.status === 'finished')

  return (
    <main className="page">
      {live.length > 0 && (
        <section>
          <h2>Élő mérkőzések</h2>
          <div className="scoreboard-grid">
            {live.map((m) => (
              <ScoreBoard key={m.match_id} match={m} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Tabella</h2>
        <StandingsTable standings={standings} />
      </section>

      <section>
        <h2>Következő mérkőzések</h2>
        {upcoming.length === 0 ? (
          <p className="hint">Nincs hátralévő mérkőzés.</p>
        ) : (
          <div className="court-columns">
            {['A', 'B'].map((court) => {
              const courtMatches = upcoming.filter((m) => m.court === court)
              return (
                <div key={court} className="court-column">
                  <h3 className="court-column-title">{court} pálya</h3>
                  {courtMatches.length === 0 ? (
                    <p className="hint">Nincs mérkőzés ezen a pályán.</p>
                  ) : (
                    <div className="court-column-list">
                      {courtMatches.map((m) => (
                        <ScoreBoard key={m.match_id} match={m} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {finished.length > 0 && (
        <section>
          <h2>Lezárt mérkőzések</h2>
          <div className="scoreboard-grid">
            {finished.map((m) => (
              <ScoreBoard key={m.match_id} match={m} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
