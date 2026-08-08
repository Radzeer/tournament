export default function StandingsTable({ standings }) {
  if (standings.length === 0) {
    return <p className="hint">Még nincs lezárt mérkőzés, a tabella üres.</p>
  }

  return (
    <div className="standings-wrapper">
      <table className="standings">
        <thead>
          <tr>
            <th>Csapat</th>
            <th>M</th>
            <th>Gy</th>
            <th>D</th>
            <th>V</th>
            <th>LG</th>
            <th>KG</th>
            <th>GK</th>
            <th>Pont</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row.team}>
              <td>{row.team}</td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.drawn}</td>
              <td>{row.lost}</td>
              <td>{row.goals_for}</td>
              <td>{row.goals_against}</td>
              <td>{row.goal_diff}</td>
              <td className="points">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
