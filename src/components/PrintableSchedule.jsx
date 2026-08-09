function dateKeyOf(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateHeading(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(matches) {
  const map = new Map()
  matches.forEach((m) => {
    const key = dateKeyOf(m.scheduled_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(m)
  })
  return [...map.entries()]
}

export default function PrintableSchedule({ matches }) {
  const days = groupByDate(matches)

  return (
    <div className="print-schedule">
      <h1>Mérkőzés menetrend</h1>
      {days.length === 0 && <p>Nincs felvitt mérkőzés.</p>}
      {days.map(([dateKey, dayMatches]) => (
        <div key={dateKey} className="print-schedule-day">
          <h2>{formatDateHeading(dateKey)}</h2>
          <table>
            <thead>
              <tr>
                <th>Idő</th>
                <th>Pálya</th>
                <th>Hazai</th>
                <th>Vendég</th>
                <th>Eredmény</th>
              </tr>
            </thead>
            <tbody>
              {dayMatches.map((m) => (
                <tr key={m.match_id}>
                  <td>{formatTime(m.scheduled_at)}</td>
                  <td>{m.court}</td>
                  <td>{m.home_team}</td>
                  <td>{m.away_team}</td>
                  <td>{m.status === 'upcoming' ? '–' : `${m.home_goals} : ${m.away_goals}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
