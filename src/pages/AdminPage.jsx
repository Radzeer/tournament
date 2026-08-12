import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ScheduleAdmin from '../components/ScheduleAdmin.jsx'
import TeamsAdmin from '../components/TeamsAdmin.jsx'

const EVENT_LABELS = {
  goal: 'Gól',
  penalty_goal: 'Büntetőgól',
  penalty_miss: 'Kihagyott büntető',
}

const TABS = [
  { id: 'live', label: 'Mérkőzés vezetés' },
  { id: 'schedule', label: 'Menetrend' },
  { id: 'teams', label: 'Csapatok' },
]

export default function AdminPage() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (checkingSession) return <p className="hint page">Betöltés…</p>
  if (!session) return <LoginForm />
  return <AdminShell onSignOut={() => supabase.auth.signOut()} />
}

function AdminShell({ onSignOut }) {
  const [tab, setTab] = useState('live')

  return (
    <main className="page">
      <div className="admin-header">
        <nav className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={t.id === tab ? 'is-active' : 'ghost'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button className="ghost" onClick={onSignOut}>
          Kilépés
        </button>
      </div>

      {tab === 'live' && <MatchManager />}
      {tab === 'schedule' && <ScheduleAdmin />}
      {tab === 'teams' && <TeamsAdmin />}
    </main>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Hibás e-mail cím vagy jelszó.')
    setPending(false)
  }

  return (
    <main className="page page-narrow">
      <h2>Admin belépés</h2>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          E-mail cím
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Jelszó
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Belépés…' : 'Belépés'}
        </button>
      </form>
    </main>
  )
}

function MatchManager() {
  const [matches, setMatches] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const loadMatches = useCallback(async () => {
    const { data } = await supabase
      .from('match_results')
      .select('*')
      .in('status', ['upcoming', 'live'])
      .order('scheduled_at', { ascending: true })
    setMatches(data ?? [])
  }, [])

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  async function startMatch(matchId) {
    await supabase.from('matches').update({ status: 'live' }).eq('id', matchId)
    loadMatches()
  }

  async function finishMatch(matchId) {
    await supabase.from('matches').update({ status: 'finished' }).eq('id', matchId)
    setSelectedId(null)
    loadMatches()
  }

  return (
    <div>
      <ul className="match-list">
        {matches.map((m) => (
          <li key={m.match_id} className={m.match_id === selectedId ? 'is-selected' : ''}>
            <button onClick={() => setSelectedId(m.match_id)}>
              <span>
                {m.home_team} {m.home_goals} : {m.away_goals} {m.away_team}
              </span>
              <span className="tag">
                {m.court} pálya · {m.status === 'live' ? 'Élő' : 'Következik'}
              </span>
            </button>
            {m.status === 'upcoming' && (
              <button className="ghost" onClick={() => startMatch(m.match_id)}>
                Meccs indítása
              </button>
            )}

            {m.match_id === selectedId && m.status === 'live' && (
              <MatchEventPanel
                match={m}
                onFinish={() => finishMatch(m.match_id)}
                onEventRecorded={loadMatches}
              />
            )}

            {m.match_id === selectedId && m.status === 'upcoming' && (
              <p className="hint">
                Ez a mérkőzés még nem indult el. Gólt csak az "Meccs indítása" gomb
                megnyomása után lehet rögzíteni hozzá.
              </p>
            )}
          </li>
        ))}
        {matches.length === 0 && <p className="hint">Nincs induló vagy élő mérkőzés.</p>}
      </ul>
    </div>
  )
}

function MatchEventPanel({ match, onFinish, onEventRecorded }) {
  const [minute, setMinute] = useState('')
  const [homeId, setHomeId] = useState(null)
  const [awayId, setAwayId] = useState(null)
  const [recentEvents, setRecentEvents] = useState([])

  useEffect(() => {
    async function loadTeamIds() {
      const { data } = await supabase
        .from('matches')
        .select('home_team_id, away_team_id')
        .eq('id', match.match_id)
        .single()
      if (data) {
        setHomeId(data.home_team_id)
        setAwayId(data.away_team_id)
      }
    }
    loadTeamIds()
  }, [match.match_id])

  const loadRecentEvents = useCallback(async () => {
    const { data } = await supabase
      .from('match_events')
      .select('id, event_type, minute, team_id')
      .eq('match_id', match.match_id)
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentEvents(data ?? [])
  }, [match.match_id])

  useEffect(() => {
    loadRecentEvents()
  }, [loadRecentEvents])

  async function recordEvent(teamId, eventType) {
    await supabase.from('match_events').insert({
      match_id: match.match_id,
      team_id: teamId,
      event_type: eventType,
      minute: minute ? Number(minute) : null,
    })
    loadRecentEvents()
    onEventRecorded()
  }

  async function undoLastEvent() {
    const last = recentEvents[0]
    if (!last) return
    const { error } = await supabase.from('match_events').delete().eq('id', last.id)
    if (error) {
      window.alert('Nem sikerült visszavonni az eseményt: ' + error.message)
      return
    }
    loadRecentEvents()
    onEventRecorded()
  }

  async function deleteEvent(eventId) {
    if (!window.confirm('Biztosan törlöd ezt az eseményt?')) return
    const { error } = await supabase.from('match_events').delete().eq('id', eventId)
    if (error) {
      window.alert('Nem sikerült törölni az eseményt: ' + error.message)
      return
    }
    loadRecentEvents()
    onEventRecorded()
  }

  return (
    <section className="event-panel">
      <div className="event-panel-header">
        <h3>
          {match.home_team} {match.home_goals} : {match.away_goals} {match.away_team}
          <span className="tag" style={{ marginLeft: '0.5rem' }}>
            {match.court} pálya
          </span>
        </h3>
        <label className="minute-input">
          Perc
          <input
            type="number"
            min="0"
            max="200"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
          />
        </label>
      </div>

      <div className="event-panel-teams">
        <TeamEventButtons teamName={match.home_team} teamId={homeId} onRecord={recordEvent} />
        <TeamEventButtons teamName={match.away_team} teamId={awayId} onRecord={recordEvent} />
      </div>

      <button className="ghost undo-button" disabled={recentEvents.length === 0} onClick={undoLastEvent}>
        ↺ Legutóbbi esemény visszavonása
      </button>

      <div className="event-log">
        <h4>Utolsó események</h4>
        <ul>
          {recentEvents.map((e) => (
            <li key={e.id}>
              <span>
                {e.minute != null ? `${e.minute}'` : '—'} · {EVENT_LABELS[e.event_type]}
                {e.team_id === homeId && ` (${match.home_team})`}
                {e.team_id === awayId && ` (${match.away_team})`}
              </span>
              <button className="ghost small" onClick={() => deleteEvent(e.id)}>
                Törlés
              </button>
            </li>
          ))}
          {recentEvents.length === 0 && <li>Még nincs esemény.</li>}
        </ul>
      </div>

      <button className="danger" onClick={onFinish}>
        Mérkőzés lezárása
      </button>
    </section>
  )
}

function TeamEventButtons({ teamName, teamId, onRecord }) {
  return (
    <div className="team-buttons">
      <h4>{teamName}</h4>
      <button disabled={!teamId} onClick={() => onRecord(teamId, 'goal')}>
        +1 gól
      </button>
      <button disabled={!teamId} onClick={() => onRecord(teamId, 'penalty_goal')}>
        +1 büntetőgól
      </button>
      <button disabled={!teamId} className="ghost" onClick={() => onRecord(teamId, 'penalty_miss')}>
        Kihagyott büntető
      </button>
    </div>
  )
}
