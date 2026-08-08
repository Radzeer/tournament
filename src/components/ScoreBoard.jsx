function statusLabel(status) {
  if (status === 'live') return 'Élő'
  if (status === 'finished') return 'Vége'
  return 'Következik'
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('hu-HU', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ScoreBoard({ match }) {
  const isLive = match.status === 'live'
  return (
    <div className={`scoreboard ${isLive ? 'is-live' : ''}`}>
      <div className="scoreboard-status">
        {isLive && <span className="live-dot" aria-hidden="true" />}
        <span>{statusLabel(match.status)}</span>
        <span aria-hidden="true">·</span>
        <span>{match.court} pálya</span>
      </div>
      <div className="scoreboard-teams">
        <span className="team-name">{match.home_team}</span>
        <span className="score">
          {match.home_goals} : {match.away_goals}
        </span>
        <span className="team-name team-name-away">{match.away_team}</span>
      </div>
      {!isLive && <div className="scoreboard-time">{formatDateTime(match.scheduled_at)}</div>}
    </div>
  )
}
