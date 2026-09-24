export const STORAGE_KEY = 'battle-h2o-game'
export const ROUND_LENGTH = 14
export const TOTAL_DAYS = ROUND_LENGTH * 2
export const GLASS_ML = 500
export const PEEKS_PER_ROUND = 3

export const localDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function plusDays(date, amount) {
  const result = new Date(`${date}T00:00:00`)
  result.setDate(result.getDate() + amount)
  return localDate(result)
}

// Rounding absorbs the 23/25-hour days around daylight-saving changes.
export const daysBetween = (from, to) =>
  Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86_400_000)

export function createGame(names, startDate) {
  return {
    startDate,
    players: names.map((name) => ({ name, photo: '', views: PEEKS_PER_ROUND })),
    logs: [{}, {}],
    overrides: [],
    requests: [],
  }
}

export function parseGame(raw) {
  let game
  try {
    game = JSON.parse(raw || 'null')
  } catch {
    return null
  }
  const validPlayers = Array.isArray(game?.players) && game.players.length === 2 && game.players.every((player) => typeof player?.name === 'string')
  if (!validPlayers || !/^\d{4}-\d{2}-\d{2}$/.test(game.startDate)) return null
  game.overrides = (Array.isArray(game.overrides) ? game.overrides : []).map((override) =>
    typeof override === 'string' ? { player: null, date: override } : override,
  )
  game.requests = Array.isArray(game.requests) ? game.requests : []
  game.logs = Array.isArray(game.logs) && game.logs.length === 2 ? game.logs : [{}, {}]
  return game
}

export const roundForDate = (game, date) => (date >= plusDays(game.startDate, ROUND_LENGTH) ? 2 : 1)
export const targetForRound = (round) => (round === 2 ? 3 : 2)
export const targetForDate = (game, date) => targetForRound(roundForDate(game, date))
export const endDate = (game) => plusDays(game.startDate, TOTAL_DAYS - 1)
export const challengeDay = (game, date) => daysBetween(game.startDate, date) + 1

export function daysForRound(game, round) {
  return Array.from({ length: ROUND_LENGTH }, (_, index) => plusDays(game.startDate, index + (round - 1) * ROUND_LENGTH))
}

export function phase(game, today) {
  if (today < game.startDate) return 'upcoming'
  return today > endDate(game) ? 'complete' : 'active'
}

export function isLocked(game, date, player, today) {
  return (
    date < today &&
    !game.overrides.some((override) => override.date === date && (override.player === null || override.player === player))
  )
}

export const canEdit = (game, date, player, today) => date <= today && !isLocked(game, date, player, today)
export const water = (game, player, date) => game.logs[player][date]?.water || 0

export function playerTotal(game, player, round) {
  return daysForRound(game, round).reduce((total, date) => total + water(game, player, date), 0)
}

export const grandTotal = (game, player) => playerTotal(game, player, 1) + playerTotal(game, player, 2)

export function possibleSoFar(game, today) {
  const last = today < endDate(game) ? today : endDate(game)
  let total = 0
  for (let date = game.startDate; date <= last; date = plusDays(date, 1)) total += targetForDate(game, date)
  return total
}

export function possibleInRound(game, round, today) {
  return daysForRound(game, round).filter((date) => date <= today).length * targetForRound(round)
}

// Today only counts once its goal is met, so an unfinished today never breaks a streak.
export function streak(game, player, today) {
  const end = endDate(game)
  let date = today > end ? end : today
  if (date === today && water(game, player, date) < targetForDate(game, date)) date = plusDays(date, -1)
  let count = 0
  while (date >= game.startDate && water(game, player, date) >= targetForDate(game, date)) {
    count += 1
    date = plusDays(date, -1)
  }
  return count
}

function entry(game, player, date) {
  game.logs[player][date] ||= { water: 0, weight: '' }
  return game.logs[player][date]
}

export function toggleGlass(game, player, date, glass) {
  const log = entry(game, player, date)
  log.water = log.water === glass ? glass - 1 : glass
  return log.water
}

export function addGlass(game, player, date) {
  const log = entry(game, player, date)
  log.water = Math.min(targetForDate(game, date), (log.water || 0) + 1)
  return log.water
}

export function removeGlass(game, player, date) {
  const log = entry(game, player, date)
  log.water = Math.max(0, (log.water || 0) - 1)
  return log.water
}

export function setWeight(game, player, date, weight) {
  entry(game, player, date).weight = weight
}

export function lastWeight(game, player) {
  const [date, log] =
    Object.entries(game.logs[player])
      .filter(([, log]) => log?.weight)
      .sort(([first], [second]) => second.localeCompare(first))[0] || []
  return date ? { date, weight: log.weight } : null
}

export const hasRequest = (game, player, date) =>
  game.requests.some((request) => request.player === player && request.date === date)

export function requestUnlock(game, player, date) {
  if (!hasRequest(game, player, date)) game.requests.push({ player, date })
}

export function pendingApprovals(game, player) {
  return game.requests.filter(
    (request) =>
      request.player !== player &&
      !game.overrides.some((override) => override.player === request.player && override.date === request.date),
  )
}

export function approveUnlock(game, requester, date) {
  game.overrides.push({ player: requester, date })
  game.requests = game.requests.filter((request) => request.player !== requester || request.date !== date)
}

export function usePeek(game, player) {
  if (game.players[player].views <= 0) return false
  game.players[player].views -= 1
  return true
}

export function standings(game) {
  const totals = [grandTotal(game, 0), grandTotal(game, 1)]
  const leader = totals[0] === totals[1] ? null : totals[0] > totals[1] ? 0 : 1
  return { totals, leader }
}

export function resultsCsv(game) {
  const rows = [['player', 'date', 'round', 'glasses', 'weight_kg']]
  game.players.forEach((player, index) =>
    Object.entries(game.logs[index]).forEach(([date, log]) =>
      rows.push([player.name, date, roundForDate(game, date), log.water ?? 0, log.weight ?? '']),
    ),
  )
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
}
