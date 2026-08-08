import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function TeamsAdmin() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  const loadTeams = useCallback(async () => {
    const { data } = await supabase.from('teams').select('*').order('name')
    setTeams(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  if (loading) return <p className="hint">Betöltés…</p>

  return (
    <div>
      <AddTeamForm onAdded={loadTeams} />
      <TeamList teams={teams} onChanged={loadTeams} />
    </div>
  )
}

function AddTeamForm({ onAdded }) {
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setPending(true)
    setError(null)
    const { error } = await supabase
      .from('teams')
      .insert({ name: name.trim(), logo_url: logoUrl.trim() || null })
    if (error) {
      setError(
        error.code === '23505' ? 'Ez a csapatnév már létezik.' : 'Nem sikerült létrehozni a csapatot.'
      )
    } else {
      setName('')
      setLogoUrl('')
      onAdded()
    }
    setPending(false)
  }

  return (
    <section className="event-panel">
      <h3>Új csapat</h3>
      <form className="form form-row" onSubmit={handleSubmit}>
        <label>
          Csapatnév
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Logó URL (opcionális)
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Hozzáadás…' : 'Csapat hozzáadása'}
        </button>
      </form>
    </section>
  )
}

function TeamList({ teams, onChanged }) {
  return (
    <section className="event-panel">
      <h3>Csapatok ({teams.length})</h3>
      {teams.length === 0 && <p className="hint">Még nincs felvéve csapat.</p>}
      <ul className="team-list">
        {teams.map((t) => (
          <TeamRow key={t.id} team={t} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  )
}

function TeamRow({ team, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(team.name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  async function saveEdit() {
    if (!name.trim()) return
    setPending(true)
    setError(null)
    const { error } = await supabase.from('teams').update({ name: name.trim() }).eq('id', team.id)
    setPending(false)
    if (error) {
      setError(error.code === '23505' ? 'Ez a csapatnév már létezik.' : 'Nem sikerült menteni.')
      return
    }
    setEditing(false)
    onChanged()
  }

  async function removeTeam() {
    if (!window.confirm(`Biztosan törlöd a(z) "${team.name}" csapatot?`)) return
    const { error } = await supabase.from('teams').delete().eq('id', team.id)
    if (error) {
      window.alert(
        'Ez a csapat már szerepel a menetrendben – előbb töröld, vagy sorsold újra a mérkőzéseket.'
      )
      return
    }
    onChanged()
  }

  return (
    <li>
      {editing ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={saveEdit} disabled={pending}>
            Mentés
          </button>
          <button className="ghost" onClick={() => setEditing(false)}>
            Mégse
          </button>
        </>
      ) : (
        <>
          <span>{team.name}</span>
          <button className="ghost" onClick={() => setEditing(true)}>
            Szerkesztés
          </button>
          <button className="danger" onClick={removeTeam}>
            Törlés
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </li>
  )
}
