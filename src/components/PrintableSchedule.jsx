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

export default function PrintableSchedule({ matches, siteUrl }) {
  const days = groupByDate(matches)

  return (
    <div className="print-schedule">
      <div className="print-schedule-header">
        
      </div>

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
                  <td></td>
                  <td>{m.status === 'upcoming' ? '–' : `${m.home_goals} : ${m.away_goals}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="print-schedule-footer">
        <h1>Mérkőzések és a tabella aktuális eredményei<br/>elérhetőek az alábbi QR kód beolvasásával!</h1>
        
        {siteUrl && (
          <div className="print-qr">
            <QRCodeSVG value={siteUrl} size={96} />
            <span>{siteUrl}</span>
          </div>
        )}
      </div>
    </div>
  )
}
