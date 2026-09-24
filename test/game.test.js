import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addGlass,
  approveUnlock,
  canEdit,
  challengeDay,
  createGame,
  daysBetween,
  daysForRound,
  endDate,
  grandTotal,
  hasRequest,
  isLocked,
  lastWeight,
  parseGame,
  pendingApprovals,
  phase,
  playerTotal,
  plusDays,
  possibleInRound,
  possibleSoFar,
  removeGlass,
  requestUnlock,
  resultsCsv,
  roundForDate,
  setWeight,
  standings,
  streak,
  targetForDate,
  toggleGlass,
  usePeek,
} from '../src/game.js'

const START = '2026-09-19'
const newGame = () => createGame(['Ana', 'Ben'], START)
const day = (offset) => plusDays(START, offset)

function logDays(game, player, values) {
  values.forEach((value, index) => {
    game.logs[player][day(index)] = { water: value, weight: '' }
  })
}

test('date helpers cross month ends and daylight-saving changes', () => {
  assert.equal(plusDays('2026-09-30', 1), '2026-10-01')
  assert.equal(plusDays('2026-03-01', -1), '2026-02-28')
  const originalZone = process.env.TZ
  process.env.TZ = 'Europe/Amsterdam'
  try {
    assert.equal(plusDays('2026-10-24', 1), '2026-10-25')
    assert.equal(plusDays('2026-10-25', 1), '2026-10-26')
    assert.equal(daysBetween('2026-10-20', '2026-10-30'), 10)
    assert.equal(daysBetween('2026-03-25', '2026-04-02'), 8)
  } finally {
    if (originalZone === undefined) delete process.env.TZ
    else process.env.TZ = originalZone
  }
})

test('two 14-day rounds with goals of 2 then 3 glasses', () => {
  const game = newGame()
  assert.equal(roundForDate(game, day(0)), 1)
  assert.equal(roundForDate(game, day(13)), 1)
  assert.equal(roundForDate(game, day(14)), 2)
  assert.equal(targetForDate(game, day(13)), 2)
  assert.equal(targetForDate(game, day(14)), 3)
  assert.deepEqual(daysForRound(game, 1).slice(0, 2), [day(0), day(1)])
  assert.equal(daysForRound(game, 2)[13], day(27))
  assert.equal(endDate(game), day(27))
  assert.equal(challengeDay(game, day(5)), 6)
})

test('phase follows the challenge window', () => {
  const game = newGame()
  assert.equal(phase(game, day(-1)), 'upcoming')
  assert.equal(phase(game, day(0)), 'active')
  assert.equal(phase(game, day(27)), 'active')
  assert.equal(phase(game, day(28)), 'complete')
})

test('past days lock unless a matching or legacy override exists', () => {
  const game = newGame()
  const today = day(5)
  assert.equal(isLocked(game, day(4), 0, today), true)
  assert.equal(isLocked(game, today, 0, today), false)
  assert.equal(canEdit(game, day(6), 0, today), false, 'future days are not editable')
  game.overrides.push({ player: 1, date: day(4) })
  assert.equal(isLocked(game, day(4), 0, today), true, 'overrides are per player')
  assert.equal(isLocked(game, day(4), 1, today), false)
  game.overrides.push({ player: null, date: day(3) })
  assert.equal(isLocked(game, day(3), 0, today), false, 'legacy overrides unlock both players')
})

test('parseGame migrates legacy data and rejects malformed data', () => {
  const legacy = {
    startDate: START,
    players: [{ name: 'Ana', photo: '', views: 3 }, { name: 'Ben', photo: '', views: 2 }],
    logs: [{ [START]: { water: 2, weight: '' } }, {}],
    overrides: ['2026-09-20'],
  }
  const game = parseGame(JSON.stringify(legacy))
  assert.deepEqual(game.overrides, [{ player: null, date: '2026-09-20' }])
  assert.deepEqual(game.requests, [])
  assert.equal(game.logs[0][START].water, 2)
  assert.deepEqual(parseGame(JSON.stringify({ ...legacy, logs: 'broken' })).logs, [{}, {}])
  assert.equal(parseGame(null), null)
  assert.equal(parseGame('{not json'), null)
  assert.equal(parseGame(JSON.stringify({ startDate: START, players: [] })), null)
  assert.equal(parseGame(JSON.stringify({ ...legacy, startDate: 'soon' })), null)
})

test('toggleGlass keeps the original tap-to-toggle behaviour', () => {
  const game = newGame()
  assert.equal(toggleGlass(game, 0, START, 2), 2)
  assert.equal(toggleGlass(game, 0, START, 2), 1, 'tapping the last filled glass empties it')
  assert.equal(toggleGlass(game, 0, START, 1), 0)
  assert.deepEqual(game.logs[0][START], { water: 0, weight: '' })
})

test('addGlass stops at the daily goal and removeGlass stops at zero', () => {
  const game = newGame()
  assert.equal(addGlass(game, 0, START), 1)
  assert.equal(addGlass(game, 0, START), 2)
  assert.equal(addGlass(game, 0, START), 2)
  assert.equal(addGlass(game, 0, day(14)), 1)
  game.logs[0][day(14)].water = 3
  assert.equal(addGlass(game, 0, day(14)), 3)
  assert.equal(removeGlass(game, 1, START), 0)
})

test('totals, possible glasses and standings', () => {
  const game = newGame()
  logDays(game, 0, [2, 1, 2])
  logDays(game, 1, [2, 2, 2])
  game.logs[0][day(14)] = { water: 3, weight: '' }
  assert.equal(playerTotal(game, 0, 1), 5)
  assert.equal(playerTotal(game, 0, 2), 3)
  assert.equal(grandTotal(game, 0), 8)
  assert.equal(possibleSoFar(game, day(-3)), 0)
  assert.equal(possibleSoFar(game, day(2)), 6)
  assert.equal(possibleSoFar(game, day(14)), 14 * 2 + 3)
  assert.equal(possibleSoFar(game, day(40)), 14 * 2 + 14 * 3)
  assert.equal(possibleInRound(game, 1, day(2)), 6)
  assert.equal(possibleInRound(game, 2, day(2)), 0)
  assert.deepEqual(standings(game), { totals: [8, 6], leader: 0 })
  game.logs[1][day(3)] = { water: 2, weight: '' }
  assert.equal(standings(game).leader, null, 'equal totals are a tie')
})

test('streak counts consecutive goal days and waits for today', () => {
  const game = newGame()
  logDays(game, 0, [2, 0, 2, 2, 2, 1])
  assert.equal(streak(game, 0, day(5)), 3, 'an unfinished today does not break the streak')
  game.logs[0][day(5)].water = 2
  assert.equal(streak(game, 0, day(5)), 4)
  assert.equal(streak(game, 0, day(7)), 0, 'a missed yesterday resets the streak')
  assert.equal(streak(game, 1, day(5)), 0)
  assert.equal(streak(game, 0, day(-2)), 0)
  logDays(game, 1, Array(28).fill(3))
  assert.equal(streak(game, 1, day(40)), 28, 'a finished challenge reports its final streak')
})

test('unlock requests wait for the other player to approve', () => {
  const game = newGame()
  requestUnlock(game, 0, day(1))
  requestUnlock(game, 0, day(1))
  assert.equal(game.requests.length, 1, 'duplicate requests are ignored')
  assert.equal(hasRequest(game, 0, day(1)), true)
  assert.deepEqual(pendingApprovals(game, 0), [], 'players cannot approve their own requests')
  assert.deepEqual(pendingApprovals(game, 1), [{ player: 0, date: day(1) }])
  approveUnlock(game, 0, day(1))
  assert.deepEqual(game.overrides, [{ player: 0, date: day(1) }])
  assert.equal(hasRequest(game, 0, day(1)), false)
  assert.equal(isLocked(game, day(1), 0, day(5)), false)
})

test('peeks run out after three uses', () => {
  const game = newGame()
  assert.deepEqual([usePeek(game, 0), usePeek(game, 0), usePeek(game, 0), usePeek(game, 0)], [true, true, true, false])
  assert.equal(game.players[0].views, 0)
  assert.equal(game.players[1].views, 3)
})

test('weights and CSV export', () => {
  const game = newGame()
  setWeight(game, 0, day(0), '82.4')
  setWeight(game, 0, day(3), '81.9')
  game.logs[0][day(4)] = { water: 1, weight: '' }
  assert.deepEqual(lastWeight(game, 0), { date: day(3), weight: '81.9' })
  assert.equal(lastWeight(game, 1), null)
  game.players[1].name = 'Ben "Bubbles"'
  game.logs[1][day(15)] = { water: 3 }
  const csv = resultsCsv(game).split('\n')
  assert.equal(csv[0], '"player","date","round","glasses","weight_kg"')
  assert.equal(csv[1], `"Ana","${day(0)}","1","0","82.4"`)
  assert.equal(csv.at(-1), `"Ben ""Bubbles""","${day(15)}","2","3",""`)
})
