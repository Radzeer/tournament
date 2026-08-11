import { formatTime } from '../lib/dateFormat.js'

const BLANK_ROWS = 8

export default function RefereeSheet({ matches, court, refereeName }) {
  const courtMatches = matches.filter((m) => m.court === court)

  return (
    <div className="print-referee-sheet">
      <div className="print-referee-header">
        <h1>{court} pálya – Bírói jegyzőkönyv</h1>
        <p>
          Játékvezető:{' '}
          {refereeName ? refereeName : <span className="print-fill-line">&nbsp;</span>}
        </p>
      </div>

      {courtMatches.length === 0 && <p>Nincs mérkőzés ezen a pályán.</p>}

      {courtMatches.map((m) => (
        <div key={m.match_id} className="print-referee-match">
          <div className="print-referee-match-header">
            <span className="print-referee-time">{formatTime(m.scheduled_at)}</span>
            <span className="print-referee-teams">
              {m.home_team} – {m.away_team}
            </span>
            <span className="print-referee-score">Végeredmény: _____ : _____</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Perc</th>
                <th>Csapat</th>
                <th>Esemény (gól / büntetőgól / kihagyott büntető)</th>
                <th>Megjegyzés</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: BLANK_ROWS }).map((_, i) => (
                <tr key={i}>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <p className="print-referee-signature">Játékvezető aláírása: _______________________</p>
    </div>
  )
}
