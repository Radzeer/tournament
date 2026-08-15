import { QRCodeSVG } from 'qrcode.react'
import { dateKeyOf, formatDateHeading, formatTime } from '../lib/dateFormat.js'

function groupByDate(matches) {
  const map = new Map()
  matches.forEach((m) => {
    const key = dateKeyOf(m.scheduled_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(m)
  })
  return [...map.entries()]
}

function ScheduleTable({ matches, referees }) {
  const days = groupByDate(matches)

  return (
    <div className="print-schedule-section">
      {days.length === 0 && <p>Nincs mérkőzés.</p>}
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
                <th>Játékvezető</th>
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
                  <td>{referees?.[m.court] || '—'}</td>
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

export default function PrintableSchedule({ matches, siteUrl, referees = {} }) {
  const courtA = matches.filter((m) => m.court === 'A')
  const courtB = matches.filter((m) => m.court === 'B')

  return (
    <div className="print-schedule">
      

      <ScheduleTable matches={matches} referees={referees} />

      <div className="print-schedule-header">
        <h1>Mérkőzések és a tabella aktuális eredményei<br/>elérhetőek az alábbi QR kód beolvasásával!</h1>
        
        {siteUrl && (
          <div className="print-qr">
            <QRCodeSVG value={siteUrl} size={96} />
            <span>{siteUrl}</span>
          </div>
        )}
      </div>

      <h1 className="print-court-title print-page-break">
        A pálya menetrendje
        {referees.A && <span className="print-referee-note"> — Játékvezető: {referees.A}</span>}
      </h1>
      <ScheduleTable matches={courtA} referees={referees} />

      <h1 className="print-court-title print-page-break">
        B pálya menetrendje
        {referees.B && <span className="print-referee-note"> — Játékvezető: {referees.B}</span>}
      </h1>
      <ScheduleTable matches={courtB} referees={referees} />
    </div>
  )
}
