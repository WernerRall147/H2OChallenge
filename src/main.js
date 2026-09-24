import './style.css'

const STORAGE_KEY = 'battle-h2o-game'
const ROUND_LENGTH = 14
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = () => localDate(new Date())
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const photo = (player) => player.photo ? `<img src="${escapeHtml(player.photo)}" alt="" />` : escapeHtml(player.name[0])
const formatDate = (date) => new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00`))
const plusDays = (date, amount) => {
  const result = new Date(`${date}T00:00:00`)
  result.setDate(result.getDate() + amount)
  return localDate(result)
}

let game = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
if (game) {
  game.overrides = (Array.isArray(game.overrides) ? game.overrides : []).map((override) => typeof override === 'string' ? { player: null, date: override } : override)
  game.requests = Array.isArray(game.requests) ? game.requests : []
  game.logs = Array.isArray(game.logs) && game.logs.length === 2 ? game.logs : [{}, {}]
}
let activePlayer = 0
let showingOpponent = false
let currentTab = 'home'

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(game))
}

function daysForRound(round) {
  return Array.from({ length: ROUND_LENGTH }, (_, index) => plusDays(game.startDate, index + (round - 1) * ROUND_LENGTH))
}

function roundForDate(date) {
  return date >= plusDays(game.startDate, ROUND_LENGTH) ? 2 : 1
}

function isLocked(date, playerIndex) {
  return date < today() && !game.overrides.some((override) => override.date === date && (override.player === null || override.player === playerIndex))
}

function playerTotal(player, round) {
  return daysForRound(round).reduce((total, date) => total + (game.logs[player][date]?.water || 0), 0)
}

function renderSetup() {
  document.querySelector('#app').innerHTML = `
    <main class="setup">
      <section class="setup-card">
        <span class="eyebrow">28 DAYS OF SPLASH</span>
        <div class="drop">💧</div>
        <h1>Battle H2O</h1>
        <p class="lead">A tiny two-player water challenge with a mighty finish line.</p>
        <form id="setup-form">
          <label>Player one <input required name="first" maxlength="18" placeholder="Your nickname" /></label>
          <label>Player two <input required name="second" maxlength="18" placeholder="Their nickname" /></label>
          <label>Challenge starts <input required name="start" type="date" value="${today()}" /></label>
          <button class="primary" type="submit">Start the splash →</button>
        </form>
        <p class="tiny">Two rounds · 14 days each · your device keeps the score</p>
        <p class="tiny">Use nicknames. Photos and weights are optional. Challenge data stays in this browser and is not encrypted by the app; anyone using this browser can access it. GitHub hosts the site and receives normal web request metadata. Delete saved data in More → End &amp; delete.</p>
      </section>
    </main>`
  document.querySelector('#setup-form').addEventListener('submit', (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const names = [form.get('first').trim(), form.get('second').trim()]
    if (names.some((name) => !name)) return alert('Please enter a name for both players.')
    game = {
      startDate: form.get('start'),
      players: [
        { name: names[0], photo: '', views: 3 },
        { name: names[1], photo: '', views: 3 },
      ],
      logs: [{}, {}],
      overrides: [],
      requests: [],
    }
    save()
    render()
  })
}

function render() {
  if (!game) return renderSetup()
  const player = game.players[activePlayer]
  const opponent = game.players[1 - activePlayer]
  const currentRound = roundForDate(today())
  const visiblePlayer = showingOpponent ? 1 - activePlayer : activePlayer
  const roundDays = daysForRound(currentRound)
  const target = currentRound === 1 ? 2 : 3
  document.querySelector('#app').innerHTML = `
    <main class="app-shell">
      <header>
        <button class="brand" data-action="home">💧 <span>Battle H2O</span></button>
        <div class="round-badge">Round ${currentRound} <b>${target} × 500ml</b></div>
        <button class="avatar" data-action="switch" aria-label="Switch player">${photo(player)}</button>
      </header>
      <section class="hero">
        <div>
          <span class="eyebrow">${today() < game.startDate ? `STARTS ${formatDate(game.startDate)}` : today() > roundDays[ROUND_LENGTH - 1] ? 'CHALLENGE COMPLETE' : `ROUND ${currentRound} · DAY ${roundDays.indexOf(today()) + 1}`}</span>
          <h1>${showingOpponent ? `${escapeHtml(opponent.name)}'s scorecard` : `Make today <em>count.</em>`}</h1>
          <p>${showingOpponent ? 'A peek at their splash streak.' : `${escapeHtml(player.name)}, every 500ml gets you closer to the crown.`}</p>
        </div>
        <div class="hero-score"><strong>${playerTotal(visiblePlayer, currentRound)}</strong><span>glasses<br />logged</span></div>
      </section>
      <nav>
        <button class="tab ${currentTab === 'home' ? 'active' : ''}" data-action="home">Today</button>
        <button class="tab ${currentTab === 'leaderboard' ? 'active' : ''}" data-action="leaderboard">Leaderboard</button>
        <button class="tab ${currentTab === 'prizes' ? 'active' : ''}" data-action="prizes">Prizes</button>
        <button class="tab ${currentTab === 'more' ? 'active' : ''}" data-action="more">More</button>
      </nav>
      <section class="content" id="content">${currentTab === 'home' ? renderTracker(visiblePlayer, currentRound, target) : ''}</section>
    </main>`
  if (currentTab === 'leaderboard') renderLeaderboard()
  else if (currentTab === 'prizes') renderPrizes()
  else if (currentTab === 'more') renderMore()
  else bindEvents()
}

function renderTracker(playerIndex, round, target) {
  const player = game.players[playerIndex]
  const isOwn = playerIndex === activePlayer
  return `
    ${showingOpponent ? `<div class="notice"><span>👀</span> Opponent view ${3 - game.players[activePlayer].views} of 3 · <button data-action="hide-opponent">Back to mine</button></div>` : ''}
    <div class="section-heading"><div><h2>${isOwn ? 'Your' : `${escapeHtml(player.name)}'s`} daily flow</h2><p>Tap each glass when it is done. A day locks after midnight.</p></div><span class="goal">Daily goal: ${target} glasses</span></div>
    <div class="tracker">
      <div class="tracker-head"><span>Date</span><span>Water</span><span>Weight</span></div>
      ${daysForRound(round).map((date) => row(date, playerIndex, target, isOwn)).join('')}
    </div>
    <div class="photo-card">
      <div class="photo-circle">${player.photo ? photo(player) : '📸'}</div>
      <div><h3>Progress portrait</h3><p>Keep a visual little memory of the journey.</p></div>
      ${isOwn ? '<label class="outline upload">Add photo<input id="photo-input" type="file" accept="image/*" /></label>' : ''}
    </div>`
}

function row(date, playerIndex, target, isOwn) {
  const log = game.logs[playerIndex][date] || { water: 0, weight: '' }
  const locked = isLocked(date, playerIndex)
  const future = date > today()
  const glasses = Array.from({ length: target }, (_, index) => `
    <button class="glass ${index < log.water ? 'filled' : ''}" ${!isOwn || locked || future ? 'disabled' : ''} data-action="water" data-date="${date}" data-glass="${index + 1}" aria-label="Glass ${index + 1} for ${formatDate(date)}" aria-pressed="${index < log.water}">💧</button>`).join('')
  return `<article class="day-row ${date === today() ? 'today' : ''} ${locked ? 'locked' : ''}">
    <div class="date"><b>${formatDate(date)}</b>${date === today() ? '<small>Today</small>' : ''}</div>
    <div class="glasses">${glasses}<span>${log.water || 0}/${target}</span></div>
    <div class="weight">${locked && !isOwn ? '' : `<input ${!isOwn || locked || future ? 'disabled' : ''} data-date="${date}" data-action="weight" type="number" min="0.1" step="any" inputmode="decimal" value="${escapeHtml(log.weight || '')}" placeholder="kg" aria-label="Weight in kilograms for ${formatDate(date)}" />`}${locked && isOwn ? '<span class="lock">🔒</span>' : ''}</div>
    ${locked && isOwn ? `<button class="request" data-action="request" data-date="${date}">Request unlock</button>` : ''}
  </article>`
}

function bindEvents() {
  const app = document.querySelector('#app')
  app.onclick = (event) => {
    const control = event.target.closest('[data-action]')
    if (control && control.dataset.action !== 'weight') handleAction({ currentTarget: control })
  }
  app.onchange = (event) => {
    if (event.target.matches('input[data-action="weight"]')) handleAction({ currentTarget: event.target })
  }
  const photoInput = document.querySelector('#photo-input')
  if (photoInput) photoInput.addEventListener('change', handlePhoto)
}

function handleAction(event) {
  const { action, date, glass } = event.currentTarget.dataset
  if ((action === 'water' || action === 'weight') && (showingOpponent || date > today() || isLocked(date, activePlayer))) {
    render()
    return
  }
  if (action === 'water') {
    const log = game.logs[activePlayer][date] ||= { water: 0, weight: '' }
    log.water = log.water === Number(glass) ? Number(glass) - 1 : Number(glass)
    save(); render()
  }
  if (action === 'weight') {
    if (!event.currentTarget.reportValidity()) return
    game.logs[activePlayer][date] ||= { water: 0, weight: '' }
    game.logs[activePlayer][date].weight = event.currentTarget.value
    save()
  }
  if (action === 'request') {
    if (!game.requests.some((request) => request.player === activePlayer && request.date === date)) game.requests.push({ player: activePlayer, date })
    currentTab = 'more'; save(); render()
  }
  if (action === 'switch') { activePlayer = 1 - activePlayer; showingOpponent = false; render() }
  if (action === 'home') { showingOpponent = false; currentTab = 'home'; render() }
  if (action === 'leaderboard') { currentTab = 'leaderboard'; render() }
  if (action === 'prizes') { currentTab = 'prizes'; render() }
  if (action === 'more') { currentTab = 'more'; render() }
  if (action === 'hide-opponent') { showingOpponent = false; render() }
  if (action === 'peek') {
    if (game.players[activePlayer].views > 0) { game.players[activePlayer].views--; showingOpponent = true; currentTab = 'home'; save(); render() }
  }
  if (action === 'approve') {
    const requester = Number(event.currentTarget.dataset.player)
    game.overrides.push({ player: requester, date })
    game.requests = game.requests.filter((request) => request.player !== requester || request.date !== date)
    currentTab = 'more'; save(); render()
  }
  if (action === 'download') downloadResults()
  if (action === 'share') shareLink()
  if (action === 'reset' && confirm('End this challenge and erase all saved results from this device?')) { localStorage.removeItem(STORAGE_KEY); game = null; renderSetup() }
}

async function shareLink() {
  const url = new URL(location.pathname, location.origin).href
  try {
    await navigator.clipboard.writeText(url)
    alert('App link copied! Scores stay on this device; they are not shared through the link.')
  } catch {
    prompt('Copy this app link. Scores stay on this device:', url)
  }
}

function renderLeaderboard() {
  const scores = game.players.map((player, index) => ({ player, index, total: playerTotal(index, 1) + playerTotal(index, 2) })).sort((a, b) => b.total - a.total)
  const roundOneComplete = roundForDate(today()) === 2
  document.querySelector('#content').innerHTML = `<section class="leaderboard"><span class="eyebrow">THE SCOREBOARD</span><h2>Who wears the water crown?</h2>
    ${scores.map((entry, index) => `<article class="rank ${index === 0 ? 'winner' : ''}"><span class="place">${index + 1}</span><span class="player-photo">${photo(entry.player)}</span><b>${escapeHtml(entry.player.name)}</b><strong>${entry.total} <small>glasses</small></strong></article>`).join('')}
    <div class="peek-card"><div><b>👀 Opponent intel</b><p>${roundOneComplete ? 'Round one is finished — the full scoreboard is now open.' : `${game.players[activePlayer].views} of 3 peeks remaining this round.`}</p></div>${roundOneComplete ? '' : `<button class="outline" data-action="peek" ${game.players[activePlayer].views === 0 ? 'disabled' : ''}>Take a peek</button>`}</div></section>`
  bindEvents()
}

function renderPrizes() {
  document.querySelector('#content').innerHTML = `<section class="prizes"><span class="eyebrow">THE GLORY AWAITS</span><h2>Race for a reward worth toasting.</h2>
    <article class="prize grand"><span>🥇</span><div><small>FIRST PLACE</small><h3>Date night: Spur & movie</h3><p>Dinner, a movie, and champion-level bragging rights.</p></div></article>
    <article class="prize"><span>🥈</span><div><small>SECOND PLACE</small><h3>Lunch at a wine farm</h3><p>A delicious consolation prize with a beautiful view.</p></div></article>
    <p class="fine-print">The player with the most logged glasses after round two takes the top prize. Each day scores up to its displayed goal. This game is not medical advice; follow your own hydration needs and do not force extra water to compete.</p></section>`
}

function renderMore() {
  const requests = game.requests.filter((request) => request.player !== activePlayer && !game.overrides.some((override) => override.player === request.player && override.date === request.date))
  document.querySelector('#content').innerHTML = `<section class="more"><h2>Challenge controls</h2>
    <div class="control"><div><b>Share the app</b><p>Both players use this device. The link opens the app, but does not sync scores between phones.</p></div><button class="outline" data-action="share">Copy link</button></div>
    <div class="control"><div><b>Your privacy</b><p>Names, photos and weights stay in this browser, without app-level encryption. Player switching is not password protection. Other apps on this same web origin may access this storage.</p></div></div>
    <div class="control"><div><b>Download results</b><p>The CSV includes player names and weights. Keep it private; it does not include photos.</p></div><button class="outline" data-action="download">Download CSV</button></div>
    <div class="control"><div><b>Late-day approvals</b><p>Unlock a missed day after the other player says yes.</p></div>${requests.length ? `<div>${requests.map((request) => `<button class="approve" data-action="approve" data-player="${request.player}" data-date="${request.date}">Unlock ${formatDate(request.date)}</button>`).join('')}</div>` : '<span class="muted">No requests</span>'}</div>
    <div class="control danger"><div><b>Finish the challenge</b><p>Erase saved names, photos and results from this browser. Downloaded CSVs, original photos and backups must be deleted separately.</p></div><button class="danger-button" data-action="reset">End & delete</button></div></section>`
  bindEvents()
}

function handlePhoto(event) {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 1024 * 1024) return alert('Please choose an image smaller than 1MB.')
  const reader = new FileReader()
  reader.onload = () => { game.players[activePlayer].photo = reader.result; save(); render() }
  reader.readAsDataURL(file)
}

function downloadResults() {
  const rows = [['player', 'date', 'round', 'glasses', 'weight_kg']]
  game.players.forEach((player, index) => Object.entries(game.logs[index]).forEach(([date, log]) => rows.push([player.name, date, roundForDate(date), log.water, log.weight])))
  const blob = new Blob([rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'battle-h2o-results.csv' })
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0)
}

render()
