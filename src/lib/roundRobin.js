// Körmérkőzéses (round-robin) sorsolás a "circle method" alapján.
// Páros csapatszámnál n-1 forduló, fordulónként n/2 mérkőzés; minden
// csapat minden fordulóban pontosan egyszer játszik. Páratlan
// csapatszámnál egy "pihenő" placeholdert kap a lista, azt a
// fordulót a hívó fél figyelmen kívül hagyja.
//
// A hazai pálya fordulónként váltakozik, hogy ne mindig ugyanaz a
// csapat legyen otthon a "fix" pozícióban.
export function generateRoundRobin(teamIds) {
  const teams = [...teamIds]
  if (teams.length < 2) return []
  if (teams.length % 2 !== 0) teams.push(null)

  const n = teams.length
  const fixed = teams[0]
  let rotating = teams.slice(1)
  const rounds = []

  for (let round = 0; round < n - 1; round++) {
    const roundTeams = [fixed, ...rotating]
    const matches = []

    for (let i = 0; i < n / 2; i++) {
      const a = roundTeams[i]
      const b = roundTeams[n - 1 - i]
      if (a === null || b === null) continue
      matches.push(round % 2 === 0 ? { home: a, away: b } : { home: b, away: a })
    }

    rounds.push(matches)
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)]
  }

  return rounds
}
