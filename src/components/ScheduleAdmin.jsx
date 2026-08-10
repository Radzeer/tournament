import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { generateRoundRobin } from '../lib/roundRobin'
import { dateKeyOf, formatDateHeading } from '../lib/dateFormat.js'
import PrintableSchedule from './PrintableSchedule.jsx'

const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin

const COURTS = ['A', 'B']

function statusLabel(status) {
  if (status === 'live') return 'Élő'
  if (status === 'finished') return 'Vége'
  return 'Következik'
}

function toDateInputValue(iso) {
  return new Date(iso).toISOString().slice(0, 10)
}

function toTimeInputValue(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function combineDateTime(date, time) {
  return new Date(`${date}T${time}`).toISOString()
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ScheduleAdmin() {
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [printDay, setPrintDay] = useState('all')

  const loadTeams = useCallback(async () => {
    const { data } = await supabase.from('teams').select('*').order('name')
    setTeams(data ?? [])
  }, [])

  const loadMatches = useCallback(async () => {
    const { data } = await supabase
      .from('match_results')
      .select('*')
      .order('scheduled_at', { ascending: true })
    setMatches(data ?? [])
  }, [])

  const loadCourts = useCallback(async () => {
    const { data } = await supabase.from('courts').select('*').order('code')
    setCourts(data ?? [])
  }, [])

  useEffect(() => {
    Promise.all([loadTeams(), loadMatches(), loadCourts()]).then(() => setLoading(false))
  }, [loadTeams, loadMatches, loadCourts])

  function refreshAll() {
    loadTeams()
    loadMatches()
  }

  if (loading) return <p className="hint">Betöltés…</p>

  const availableDays = [...new Set(matches.map((m) => dateKeyOf(m.scheduled_at)))].sort()
  const printMatches =
    printDay === 'all' ? matches : matches.filter((m) => dateKeyOf(m.scheduled_at) === printDay)
  const refereesByCourt = Object.fromEntries(courts.map((c) => [c.code, c.referee_name]))

  return (
    <div>
      <ScheduleGenerator teams={teams} existingCount={matches.length} onGenerated={refreshAll} />
      <MatchList matches={matches} onChanged={loadMatches} />
      <AddMatchForm teams={teams} onAdded={loadMatches} />
      <CourtsAdmin courts={courts} onChanged={loadCourts} />

      <section className="event-panel">
        <h3>Menetrend nyomtatása</h3>
        <div className="print-button-row">
          <label className="print-day-select">
            Nyomtatandó nap
            <select value={printDay} onChange={(e) => setPrintDay(e.target.value)}>
              <option value="all">Összes nap</option>
              {availableDays.map((day) => (
                <option key={day} value={day}>
                  {formatDateHeading(day)}
                </option>
              ))}
            </select>
          </label>
          <button className="ghost" onClick={() => window.print()}>
            Menetrend nyomtatása / PDF letöltése
          </button>
        </div>
        <p className="hint">
          A nyomtatott lapon az összesített menetrend mellett külön A és B
          pályás bontás is szerepel, a pályához rendelt játékvezető nevével.
        </p>
      </section>

      <PrintableSchedule matches={printMatches} siteUrl={SITE_URL} referees={refereesByCourt} />
    </div>
  )
}

function ScheduleGenerator({ teams, existingCount, onGenerated }) {
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('18:00')
  const [roundsPerDay, setRoundsPerDay] = useState(2)
  const [intervalDays, setIntervalDays] = useState(7)
  const [slotMinutes, setSlotMinutes] = useState(20)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  const roundCount = teams.length < 2 ? 0 : teams.length % 2 === 0 ? teams.length - 1 : teams.length
  const matchesPerRound = Math.floor(teams.length / 2)
  const matchCount = roundCount * matchesPerRound
  const matchesPerDay = roundsPerDay * matchesPerRound

  async function handleGenerate() {
    setError(null)

    if (teams.length < 2) {
      setError('Legalább 2 csapat kell a sorsoláshoz. Vedd fel a csapatokat a Csapatok fülön.')
      return
    }
    if (!startDate) {
      setError('Add meg az első mérkőzésnap dátumát.')
      return
    }
    if (existingCount > 0) {
      const confirmed = window.confirm(
        `Már van ${existingCount} mérkőzés a rendszerben. A generálás törli az összes ` +
          'még el nem kezdett (upcoming) mérkőzést, és újakat hoz létre. Az élő és lezárt ' +
          'mérkőzéseket nem érinti. Folytatod?'
      )
      if (!confirmed) return
    }

    setPending(true)

    const { error: deleteError } = await supabase.from('matches').delete().eq('status', 'upcoming')
    if (deleteError) {
      setError('Nem sikerült törölni a korábbi menetrendet.')
      setPending(false)
      return
    }

    const rounds = generateRoundRobin(teams)
    const rows = []
    let matchdayIndex = -1
    let slotCounter = 0

    rounds.forEach((pairs, roundIndex) => {
      const currentMatchday = Math.floor(roundIndex / roundsPerDay)
      if (currentMatchday !== matchdayIndex) {
        matchdayIndex = currentMatchday
        slotCounter = 0
      }

      const matchDate = new Date(startDate)
      matchDate.setDate(matchDate.getDate() + matchdayIndex * intervalDays)

      pairs.forEach(({ home, away }) => {
        // Két pálya (A, B) párhuzamosan fut: a forduló mérkőzései
        // felváltva kerülnek A/B pályára, egy pályán belül pedig
        // a "slotMinutes" perccel tolódik a kezdés, hogy egy napon
        // belül több meccs is elférjen.
        const court = COURTS[slotCounter % COURTS.length]
        const slot = Math.floor(slotCounter / COURTS.length)
        const [h, m] = startTime.split(':').map(Number)
        const kickoff = new Date(matchDate)
        kickoff.setHours(h, m + slot * slotMinutes, 0, 0)

        rows.push({
          home_team_id: home.id,
          away_team_id: away.id,
          scheduled_at: kickoff.toISOString(),
          court,
          status: 'upcoming',
        })
        slotCounter++
      })
    })

    const { error: insertError } = await supabase.from('matches').insert(rows)
    if (insertError) {
      setError('Nem sikerült létrehozni a menetrendet.')
    } else {
      onGenerated()
    }
    setPending(false)
  }

  return (
    <section className="event-panel">
      <h3>Menetrend generálása</h3>
      <p className="hint">
        Körmérkőzéses sorsolás: minden csapat pontosan egyszer játszik mindenki
        mással.{' '}
        {teams.length >= 2
          ? `${teams.length} csapatnál ez ${roundCount} forduló, összesen ${matchCount} mérkőzés – mérkőzésnaponta ${matchesPerDay} meccs, A és B pályára elosztva.`
          : 'Legalább 2 csapat szükséges.'}{' '}
        A dátum, időpont és pálya generálás után egyenként is módosítható.
      </p>
      <div className="form-row">
        <label>
          Első mérkőzésnap dátuma
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          Kezdés időpontja
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label>
          Fordulók naponta
          <input
            type="number"
            min="1"
            value={roundsPerDay}
            onChange={(e) => setRoundsPerDay(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <label>
          Mérkőzésnapok köze (nap)
          <input
            type="number"
            min="1"
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
          />
        </label>
        <label>
          Meccsek köze (perc)
          <input
            type="number"
            min="0"
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
          />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <button onClick={handleGenerate} disabled={pending}>
        {pending ? 'Generálás…' : 'Menetrend generálása'}
      </button>
    </section>
  )
}

function MatchList({ matches, onChanged }) {
  return (
    <section className="event-panel">
      <h3>Mérkőzések ({matches.length})</h3>
      {matches.length === 0 && <p className="hint">Még nincs egy mérkőzés sem felvéve.</p>}
      <ul className="schedule-list">
        {matches.map((m) => (
          <MatchRow key={m.match_id} match={m} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  )
}

function MatchRow({ match, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(toDateInputValue(match.scheduled_at))
  const [time, setTime] = useState(toTimeInputValue(match.scheduled_at))
  const [court, setCourt] = useState(match.court)
  const [pending, setPending] = useState(false)

  const canEdit = match.status === 'upcoming'

  async function saveChanges() {
    setPending(true)
    await supabase
      .from('matches')
      .update({ scheduled_at: combineDateTime(date, time), court })
      .eq('id', match.match_id)
    setPending(false)
    setEditing(false)
    onChanged()
  }

  async function removeMatch() {
    if (!window.confirm('Biztosan törlöd ezt a mérkőzést?')) return
    await supabase.from('matches').delete().eq('id', match.match_id)
    onChanged()
  }

  return (
    <li className="schedule-row">
      <span className="schedule-teams">
        {match.home_team} – {match.away_team}
      </span>

      {editing ? (
        <>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <select value={court} onChange={(e) => setCourt(e.target.value)}>
            {COURTS.map((c) => (
              <option key={c} value={c}>
                {c} pálya
              </option>
            ))}
          </select>
          <button onClick={saveChanges} disabled={pending}>
            Mentés
          </button>
          <button className="ghost" onClick={() => setEditing(false)}>
            Mégse
          </button>
        </>
      ) : (
        <span className="hint">{formatDateTime(match.scheduled_at)}</span>
      )}

      <span className="tag">{match.court} pálya</span>
      <span className="tag">{statusLabel(match.status)}</span>

      {canEdit && !editing && (
        <button className="ghost" onClick={() => setEditing(true)}>
          Szerkesztés
        </button>
      )}
      {canEdit && (
        <button className="danger" onClick={removeMatch}>
          Törlés
        </button>
      )}
    </li>
  )
}

function CourtsAdmin({ courts, onChanged }) {
  return (
    <section className="event-panel">
      <h3>Pályák – játékvezetők</h3>
      <p className="hint">
        Az itt megadott név a nyomtatott menetrenden is megjelenik az adott
        pályához tartozó mérkőzések mellett.
      </p>
      <div className="form-row">
        {COURTS.map((code) => {
          const court = courts.find((c) => c.code === code)
          return (
            <CourtRefereeField
              key={code}
              code={code}
              value={court?.referee_name ?? ''}
              onSaved={onChanged}
            />
          )
        })}
      </div>
    </section>
  )
}

function CourtRefereeField({ code, value, onSaved }) {
  const [name, setName] = useState(value)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setName(value)
  }, [value])

  async function save() {
    setPending(true)
    await supabase.from('courts').update({ referee_name: name.trim() || null }).eq('code', code)
    setPending(false)
    onSaved()
  }

  return (
    <label>
      {code} pálya játékvezetője
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        placeholder="Név"
        disabled={pending}
      />
    </label>
  )
}

function AddMatchForm({ teams, onAdded }) {
  const [homeId, setHomeId] = useState('')
  const [awayId, setAwayId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [court, setCourt] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (homeId === awayId) {
      setError('A hazai és a vendég csapat nem lehet ugyanaz.')
      return
    }

    setPending(true)
    setError(null)
    const { error } = await supabase.from('matches').insert({
      home_team_id: homeId,
      away_team_id: awayId,
      scheduled_at: combineDateTime(date, time),
      court,
      status: 'upcoming',
    })
    if (error) {
      setError('Nem sikerült létrehozni a mérkőzést.')
    } else {
      setHomeId('')
      setAwayId('')
      setDate('')
      setTime('')
      setCourt('')
      onAdded()
    }
    setPending(false)
  }

  return (
    <section className="event-panel">
      <h3>Új mérkőzés kézzel</h3>
      <form className="form form-row" onSubmit={handleSubmit}>
        <label>
          Hazai csapat
          <select value={homeId} onChange={(e) => setHomeId(e.target.value)} required>
            <option value="" disabled>
              Válassz
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vendég csapat
          <select value={awayId} onChange={(e) => setAwayId(e.target.value)} required>
            <option value="" disabled>
              Válassz
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dátum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Időpont
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label>
          Pálya
          <select value={court} onChange={(e) => setCourt(e.target.value)} required>
            <option value="" disabled>
              Válassz
            </option>
            {COURTS.map((c) => (
              <option key={c} value={c}>
                {c} pálya
              </option>
            ))}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Hozzáadás…' : 'Mérkőzés hozzáadása'}
        </button>
      </form>
    </section>
  )
}
