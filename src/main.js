import './style.css'
import { TANK_HEIGHT, dropSvg, glassLevel, glassSvg, miniGlassSvg, tankLevel, tankSvg } from './art.js'
import {
  GLASS_ML,
  PEEKS_PER_ROUND,
  ROUND_LENGTH,
  STORAGE_KEY,
  TOTAL_DAYS,
  addGlass,
  approveUnlock,
  canEdit,
  challengeDay,
  createGame,
  daysBetween,
  daysForRound,
  endDate,
  hasRequest,
  isLocked,
  lastWeight,
  localDate,
  parseGame,
  pendingApprovals,
  phase,
  playerTotal,
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
  targetForRound,
  toggleGlass,
  usePeek,
  water,
} from './game.js'

const app = document.querySelector('#app')
document.body.insertAdjacentHTML(
  'beforeend',
  '<div id="toast" class="toast" role="status" aria-live="polite"></div><div id="sr-status" class="sr-only" aria-live="polite"></div><div id="fx" aria-hidden="true"></div>',
)
const toastElement = document.querySelector('#toast')
const srStatus = document.querySelector('#sr-status')
const fx = document.querySelector('#fx')
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const TABS = [
  ['home', '💧', 'Today'],
  ['leaderboard', '⚔️', 'Battle'],
  ['prizes', '🏆', 'Prizes'],
  ['more', '•••', 'More'],
]
const TAB_ACTIONS = new Set(TABS.map(([tab]) => tab))
// Only iPhone/iPad Safari defines navigator.standalone; it is false when not opened from the Home Screen.
const iosBrowser = navigator.standalone === false

let game = parseGame(localStorage.getItem(STORAGE_KEY))
let activePlayer = 0
let showingOpponent = false
let currentTab = 'home'
let tideRound = null
let sheetDate = null
let sheetOpened = false
let sheetOpener = null
let focusWeight = false
let handoff = false
let fillTanks = false
let heroGlass = null
let renderedDay = null
let ids = 0
let toastTimer = 0
let announceTimer = 0

const today = () => localDate(new Date())
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const at = (date) => new Date(`${date}T00:00:00`)
const formatDate = (date) => new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short' }).format(at(date))
const formatLongDate = (date) => new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }).format(at(date))
const formatWeight = (weight) =>
  Number.isFinite(Number(weight)) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(weight)) : weight
const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`
const initial = (name) => [...name.trim()][0]?.toUpperCase() || '?'
const avatar = (player, size = '') =>
  `<span class="av ${size}">${player.photo ? `<img src="${escapeHtml(player.photo)}" alt="" />` : escapeHtml(initial(player.name))}</span>`
const keyFor = (action, date = '', glass = '', player = '', round = '') => [action, date, glass, player, round].join('|')
const focusKeyOf = (element) => {
  const data = element?.dataset
  return data?.action ? keyFor(data.action, data.date, data.glass, data.player, data.round) : null
}
const roundDay = (date) => challengeDay(game, date) - (roundForDate(game, date) - 1) * ROUND_LENGTH

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game))
    return true
  } catch {
    toast('Could not save', 'Browser storage is full or blocked. Free up some space and try again.')
    return false
  }
}

function toast(title, detail = '') {
  toastElement.innerHTML = `<strong>${escapeHtml(title)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ''}`
  toastElement.classList.remove('show')
  void toastElement.offsetWidth
  toastElement.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastElement.classList.remove('show'), 3600)
}

function announce(text) {
  srStatus.textContent = ''
  clearTimeout(announceTimer)
  announceTimer = setTimeout(() => {
    srStatus.textContent = text
  }, 60)
}

// Toasts, confetti and screen-reader messages can reveal the current player's data, so wipe them before a hand-off.
function clearFeedback() {
  clearTimeout(toastTimer)
  clearTimeout(announceTimer)
  toastElement.style.transition = 'none'
  toastElement.classList.remove('show')
  toastElement.replaceChildren()
  void toastElement.offsetWidth
  toastElement.style.transition = ''
  srStatus.textContent = ''
  fx.replaceChildren()
}

function celebrate(player) {
  const run = streak(game, player, today())
  toast('Goal smashed! 💦', run > 1 ? `${run}-day streak. Keep it flowing.` : 'Streak started. See you tomorrow!')
  navigator.vibrate?.([14, 40, 22])
  if (reducedMotion.matches) return
  const origin = app.querySelector('.hero .glass')?.getBoundingClientRect()
  if (!origin) return
  const colors = ['#ffd98c', '#7fe3d6', '#ffffff', '#2cc3b1', '#f2b84b']
  fx.replaceChildren(
    ...Array.from({ length: 28 }, (_, index) => {
      const drop = document.createElement('i')
      const angle = (index / 28) * Math.PI * 2 + Math.random() * 0.3
      const distance = 70 + Math.random() * 120
      drop.style.cssText = [
        `left:${origin.left + origin.width / 2}px`,
        `top:${origin.top + origin.height * 0.45}px`,
        `background:${colors[index % colors.length]}`,
        `--dx:${Math.round(Math.cos(angle) * distance)}px`,
        `--dy:${Math.round(Math.sin(angle) * distance - 50)}px`,
        `--spin:${Math.round(Math.random() * 540 - 270)}deg`,
        `animation-delay:${Math.round(Math.random() * 90)}ms`,
      ].join(';')
      return drop
    }),
  )
  setTimeout(() => fx.replaceChildren(), 1500)
}

function render({ focusKey } = {}) {
  ids = 0
  renderedDay = today()
  if (!game) return renderSetup()
  if (handoff) return renderHandoff()
  document.documentElement.classList.toggle('sheet-open', Boolean(sheetDate))
  app.innerHTML = `${renderTopbar()}<main class="screen" id="main">${renderTab()}</main>${renderTabbar()}${sheetDate ? renderSheet() : ''}`
  if (sheetDate) app.querySelectorAll('.topbar, #main, .tabbar').forEach((element) => (element.inert = true))
  animateWater()
  if (sheetDate && sheetOpened) {
    sheetOpened = false
    const weight = focusWeight && app.querySelector('.sheet input[data-action="weight"]:not(:disabled)')
    focusWeight = false
    // The weight field may open the keyboard, so let the browser scroll it into view.
    if (weight) weight.focus()
    else app.querySelector('#sheet-title')?.focus({ preventScroll: true })
  } else if (focusKey) {
    ;[...app.querySelectorAll('[data-action]')].find((element) => focusKeyOf(element) === focusKey)?.focus({ preventScroll: true })
  }
}

function slide(element, from, to) {
  element.style.setProperty('--level', from)
  element.getBoundingClientRect()
  requestAnimationFrame(() => element.style.setProperty('--level', to))
}

function animateWater() {
  const heroWater = app.querySelector('.hero .water')
  if (heroWater) {
    const key = heroWater.closest('.hero').dataset.key
    const level = heroWater.style.getPropertyValue('--level')
    if (!reducedMotion.matches && heroGlass?.key === key && heroGlass.level !== level) slide(heroWater, heroGlass.level, level)
    heroGlass = { key, level }
  }
  if (fillTanks) {
    fillTanks = false
    if (!reducedMotion.matches) {
      app.querySelectorAll('.tank .water').forEach((tank) => slide(tank, String(TANK_HEIGHT + 12), tank.style.getPropertyValue('--level')))
    }
  }
}

function renderSetup() {
  document.documentElement.classList.remove('sheet-open')
  app.innerHTML = `
    <main class="setup">
      <section class="setup-card">
        <div class="setup-art">${glassSvg('setup', glassLevel(0.62), 2)}</div>
        <span class="eyebrow">28 DAYS OF SPLASH</span>
        <h1>Battle H2O</h1>
        <p class="lead">A tiny two-player water challenge with a mighty finish line.</p>
        ${iosBrowser ? '<p class="ios-tip">📲 <b>On iPhone?</b> Tap Share → <b>Add to Home Screen</b> first, then start the challenge from the new icon so your scores stay in one place.</p>' : ''}
        <form id="setup-form">
          <label>Player one <input required name="first" maxlength="18" placeholder="Your nickname" autocomplete="off" autocapitalize="words" enterkeyhint="next" /></label>
          <label>Player two <input required name="second" maxlength="18" placeholder="Their nickname" autocomplete="off" autocapitalize="words" enterkeyhint="next" /></label>
          <label>Challenge starts <input required name="start" type="date" value="${today()}" /></label>
          <button class="primary" type="submit">Start the splash →</button>
        </form>
        <p class="tiny">Two rounds · 14 days each · your device keeps the score</p>
        <p class="tiny">Use nicknames. Photos and weights are optional. Challenge data stays in this browser and is not encrypted by the app; anyone using this browser can access it. GitHub hosts the site and receives normal web request metadata. Delete saved data in More → End &amp; delete.</p>
      </section>
    </main>`
}

function renderTopbar() {
  const player = game.players[activePlayer]
  const other = game.players[1 - activePlayer]
  return `<header class="topbar">
    <button class="wordmark" data-action="home" aria-label="Battle H2O: go to Today"><span aria-hidden="true">💧</span><span class="wordmark-text">Battle H2O</span></button>
    <button class="switcher" data-action="switch" aria-label="${escapeHtml(player.name)} is playing. Pass the phone to ${escapeHtml(other.name)}">
      ${avatar(player)}<span class="switcher-name">${escapeHtml(player.name)}</span><span class="swap" aria-hidden="true">⇄</span>
    </button>
  </header>`
}

function renderTabbar() {
  const approvals = pendingApprovals(game, activePlayer).length
  return `<nav class="tabbar" aria-label="Sections">${TABS.map(([tab, icon, label]) => {
    const active = currentTab === tab
    const badge =
      tab === 'more' && approvals
        ? `<span class="badge" aria-hidden="true">${approvals}</span><span class="sr-only">, ${plural(approvals, 'unlock request')}</span>`
        : ''
    return `<button class="tab${active ? ' on' : ''}" data-action="${tab}"${active ? ' aria-current="page"' : ''}><span class="tab-icon" aria-hidden="true">${icon}</span><span>${label}</span>${badge}</button>`
  }).join('')}</nav>`
}

function renderTab() {
  if (currentTab === 'leaderboard') return renderBattle()
  if (currentTab === 'prizes') return renderPrizes()
  if (currentTab === 'more') return renderMore()
  return renderToday()
}

function renderToday() {
  const now = today()
  const viewer = showingOpponent ? 1 - activePlayer : activePlayer
  const own = !showingOpponent
  const state = phase(game, now)
  const round = roundForDate(game, now)
  const notice = own
    ? ''
    : `<div class="notice" role="status"><span aria-hidden="true">👀</span><p>Peek ${PEEKS_PER_ROUND - game.players[activePlayer].views} of ${PEEKS_PER_ROUND} · ${escapeHtml(game.players[viewer].name)}'s scorecard</p><button data-action="hide-opponent">Back to mine</button></div>`
  return `${notice}${renderHero(now, viewer, own, state, round)}${renderTide(now, viewer, own, round)}${own && state === 'active' ? renderWeighIn(viewer) : ''}`
}

function renderHero(now, viewer, own, state, round) {
  const player = game.players[viewer]
  const target = targetForRound(round)
  const run = streak(game, viewer, now)
  const streakChip = run > 0 ? `<span class="chip hot">🔥 ${run}-day streak</span>` : ''
  let chips
  let count
  let fraction
  let message
  let action = ''
  if (state === 'upcoming') {
    chips = `<span class="chip">Starts ${formatLongDate(game.startDate)}</span><span class="chip">${plural(daysBetween(now, game.startDate), 'day')} to go</span>`
    count = `<b>${target}</b><span>glasses a day in round 1</span>`
    fraction = 0
    message = 'The splash starts soon. Warm up those glasses!'
    if (own) action = `<button class="log" disabled>Starts ${formatDate(game.startDate)}</button>`
  } else if (state === 'complete') {
    const total = playerTotal(game, viewer, 1) + playerTotal(game, viewer, 2)
    const possible = possibleSoFar(game, now)
    chips = `<span class="chip">Challenge complete 🏁</span>${streakChip}`
    count = `<b>${total}</b><span>glasses logged</span>`
    fraction = possible ? total / possible : 0
    message = 'Final whistle! See who wears the water crown 👑'
    action = '<button class="log gold" data-action="leaderboard">See the results</button>'
  } else {
    const glasses = water(game, viewer, now)
    const done = glasses >= target
    chips = `<span class="chip">Round ${round} · Day ${roundDay(now)} of ${ROUND_LENGTH}</span>${streakChip}`
    count = `<b>${glasses}<small>/${target}</small></b><span>glasses today</span>`
    fraction = glasses / target
    if (!own) message = 'A peek at their splash streak.'
    else if (done) message = 'Goal smashed. The crown is watching 👑'
    else if (glasses) message = `${(target - glasses) * GLASS_ML} ml to go. Keep splashing, ${player.name}!`
    else message = `Your first ${GLASS_ML} ml is waiting, ${player.name}.`
    if (own) {
      action = done
        ? '<button class="log gold" disabled>✓ Daily goal done</button>'
        : `<button class="log" data-action="log"><span aria-hidden="true">＋</span> Log ${GLASS_ML} ml</button>`
      if (glasses) action += '<button class="undo" data-action="undo">Undo last glass</button>'
    }
  }
  return `<section class="hero" data-key="${viewer}|${now}|${state}" aria-label="${own ? 'Your' : `${escapeHtml(player.name)}'s`} day">
    <div class="chips">${chips}</div>
    <div class="hero-main">${glassSvg(`hero-${++ids}`, glassLevel(fraction), target)}<div class="count">${count}<p class="message">${escapeHtml(message)}</p></div></div>
    ${action}
  </section>`
}

function renderTide(now, viewer, own, round) {
  const shown = round === 2 && tideRound === 1 ? 1 : round
  const target = targetForRound(shown)
  const days = daysForRound(game, shown)
  const possible = possibleInRound(game, shown, now)
  const toggle =
    round === 2
      ? `<div class="seg" role="group" aria-label="Show round">${[1, 2].map((value) => `<button data-action="tide-round" data-round="${value}" aria-pressed="${shown === value}">R${value}</button>`).join('')}</div>`
      : ''
  const summary = possible ? `${playerTotal(game, viewer, shown)} of ${possible} so far` : `Starts ${formatDate(days[0])}`
  return `<section class="card tide-card">
    <div class="card-head"><h2>Round ${shown} tide</h2>${toggle}</div>
    <p class="card-sub">${summary} · goal ${target} a day</p>
    <div class="tide">${days.map((date) => renderDay(date, viewer, now, target)).join('')}</div>
    <p class="hint">${own ? 'Tap a day to edit it or ask for an unlock.' : `Peek mode: ${escapeHtml(game.players[viewer].name)}'s days are read-only.`}</p>
  </section>`
}

function renderDay(date, viewer, now, target) {
  const future = date > now
  const value = water(game, viewer, date)
  const locked = isLocked(game, date, viewer, now)
  const requested = locked && hasRequest(game, viewer, date)
  const badge = future || value >= target ? '' : requested ? '⏳' : locked ? '🔒' : ''
  const status = future ? 'not started yet' : date === now ? 'today' : requested ? 'unlock requested' : locked ? 'locked' : 'unlocked'
  return `<button class="day${date === now ? ' today' : ''}" data-action="day" data-date="${date}"${future ? ' disabled' : ''} aria-label="${formatLongDate(date)}, ${value} of ${target} glasses, ${status}">
    ${dropSvg(++ids, future ? 0 : value / target, future)}${badge ? `<span class="day-badge" aria-hidden="true">${badge}</span>` : ''}<span class="day-num" aria-hidden="true">${at(date).getDate()}</span>
  </button>`
}

function renderWeighIn(viewer) {
  const last = lastWeight(game, viewer)
  const detail = last ? `Last: ${escapeHtml(formatWeight(last.weight))} kg · ${formatDate(last.date)}` : 'Optional. Log it whenever you step on the scale.'
  return `<section class="card row">
    <span class="row-icon" aria-hidden="true">⚖️</span>
    <div class="row-text"><h2>Weigh-in</h2><p>${detail}</p></div>
    <button class="pill" data-action="weigh">Log</button>
  </section>`
}

function renderBattle() {
  const now = today()
  const state = phase(game, now)
  const round = roundForDate(game, now)
  const possible = possibleSoFar(game, now)
  const { totals, leader } = standings(game)
  const views = game.players[activePlayer].views
  const dayNumber = Math.min(Math.max(challengeDay(game, now), 0), TOTAL_DAYS)
  const progress = state === 'upcoming' ? 0 : state === 'complete' ? 1 : dayNumber / TOTAL_DAYS
  const eyebrow =
    state === 'upcoming'
      ? `STARTS ${formatDate(game.startDate).toUpperCase()}`
      : state === 'complete'
        ? 'FINAL WHISTLE'
        : `ROUND ${round} · DAY ${roundDay(now)} OF ${ROUND_LENGTH}`
  const title =
    state !== 'complete' ? 'Who wears the water crown?' : leader === null ? "It's a tie! 🤝" : `${escapeHtml(game.players[leader].name)} wears the water crown! 👑`
  const remaining = TOTAL_DAYS - dayNumber
  const roadLabel =
    state === 'upcoming'
      ? `Starts in ${plural(daysBetween(now, game.startDate), 'day')}`
      : state === 'complete'
        ? 'Finished'
        : remaining
          ? `${plural(remaining, 'day')} left`
          : 'Final day!'
  const tank = (index) => {
    const player = game.players[index]
    const crowned = leader === index && state !== 'upcoming'
    return `<article class="tank${crowned ? ' leading' : ''}" aria-label="${escapeHtml(player.name)}: ${plural(totals[index], 'glass', 'glasses')}">
      ${tankSvg(++ids, tankLevel(possible ? totals[index] / possible : 0))}
      <div class="who">${crowned ? '<span class="crown" aria-hidden="true">👑</span>' : ''}${avatar(player, 'lg')}<b>${escapeHtml(player.name)}</b>${index === activePlayer ? '<small>You</small>' : ''}</div>
      <div class="score"><b>${totals[index]}</b><span>${possible ? `of ${possible} possible` : 'glasses'}</span></div>
    </article>`
  }
  const roundOneComplete = round === 2
  return `<section class="page-head"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1></section>
    <section class="arena">${tank(activePlayer)}${tank(1 - activePlayer)}<span class="vs" aria-hidden="true">VS</span></section>
    <section class="card road">
      <div class="card-head"><h2>🏁 Road to the crown</h2><span>${roadLabel}</span></div>
      <div class="track" role="progressbar" aria-label="Challenge progress" aria-valuemin="0" aria-valuemax="${TOTAL_DAYS}" aria-valuenow="${Math.round(progress * TOTAL_DAYS)}">
        <div class="fill" style="width:${(progress * 100).toFixed(1)}%"></div><i class="half"></i><span class="runner" style="--p:${(progress * 100).toFixed(1)}%" aria-hidden="true">💧</span>
      </div>
      <div class="marks"><span>Start</span><span>Halftime</span><span>Crown</span></div>
    </section>
    <section class="card row">
      <span class="row-icon" aria-hidden="true">👀</span>
      <div class="row-text"><h2>Opponent intel</h2><p>${roundOneComplete ? 'Round one is finished — the full scoreboard is now open.' : `${views} of ${PEEKS_PER_ROUND} peeks remaining this round.`}</p></div>
      ${roundOneComplete ? '' : `<button class="pill" data-action="peek"${views ? '' : ' disabled'}>Peek</button>`}
    </section>
    <button class="ticket" data-action="prizes"><span class="ticket-medal" aria-hidden="true">🥇</span><span class="ticket-text"><small>WINNER'S PRIZE</small><b>Date night: Spur &amp; movie</b></span><span class="ticket-go" aria-hidden="true">›</span></button>`
}

function renderPrizes() {
  const now = today()
  const state = phase(game, now)
  const left = daysBetween(now, endDate(game))
  const countdown =
    state === 'complete' ? 'The race is run' : state === 'upcoming' ? `Starts ${formatLongDate(game.startDate)}` : left ? `${plural(left, 'day')} to the crown` : 'Final day!'
  return `<section class="page-head"><span class="eyebrow">THE GLORY AWAITS</span><h1>Race for a reward worth toasting.</h1><span class="chip soft">🏁 ${countdown}</span></section>
    <article class="prize grand"><span class="medal" aria-hidden="true">🥇</span><div><small>FIRST PLACE</small><h2>Date night: Spur &amp; movie</h2><p>Dinner, a movie, and champion-level bragging rights.</p></div></article>
    <article class="prize"><span class="medal" aria-hidden="true">🥈</span><div><small>SECOND PLACE</small><h2>Lunch at a wine farm</h2><p>A delicious consolation prize with a beautiful view.</p></div></article>
    <p class="fine-print">The player with the most logged glasses after round two takes the top prize. Each day scores up to its displayed goal. This game is not medical advice; follow your own hydration needs and do not force extra water to compete.</p>`
}

function renderMore() {
  const player = game.players[activePlayer]
  const requests = pendingApprovals(game, activePlayer)
  const approvals = requests.length
    ? `<div class="approvals">${requests.map((request) => `<button class="approve" data-action="approve" data-player="${request.player}" data-date="${request.date}">Unlock ${formatDate(request.date)} for ${escapeHtml(game.players[request.player].name)}</button>`).join('')}</div>`
    : '<p class="muted">No requests</p>'
  return `<section class="page-head"><h1>Challenge controls</h1></section>
    <section class="card row">
      ${avatar(player, 'lg')}
      <div class="row-text"><h2>Progress portrait</h2><p>Keep a visual little memory of the journey. Photos are resized on this device before saving.</p></div>
      <label class="pill upload">${player.photo ? 'Change photo' : 'Add photo'}<input id="photo-input" type="file" accept="image/*" /></label>
    </section>
    <section class="card">
      <div class="row"><span class="row-icon" aria-hidden="true">🔓</span><div class="row-text"><h2>Late-day approvals</h2><p>Unlock a missed day after the other player says yes.</p></div></div>
      ${approvals}
    </section>
    ${
      iosBrowser
        ? `<section class="card row">
      <span class="row-icon" aria-hidden="true">🏠</span>
      <div class="row-text"><h2>Add to Home Screen</h2><p>In Safari, tap Share → Add to Home Screen for a full-screen app that also works offline. Scores saved in Safari may not carry over, so it's best done before you start.</p></div>
    </section>`
        : ''
    }
    <section class="card row">
      <span class="row-icon" aria-hidden="true">📲</span>
      <div class="row-text"><h2>Share the app</h2><p>Both players use this device. The link opens the app, but does not sync scores between phones.</p></div>
      <button class="pill" data-action="share">Share link</button>
    </section>
    <section class="card row">
      <span class="row-icon" aria-hidden="true">📄</span>
      <div class="row-text"><h2>Download results</h2><p>The CSV includes player names and weights. Keep it private; it does not include photos.</p></div>
      <button class="pill" data-action="download">Download CSV</button>
    </section>
    <section class="card row">
      <span class="row-icon" aria-hidden="true">🛡️</span>
      <div class="row-text"><h2>Your privacy</h2><p>Names, photos and weights stay in this browser, without app-level encryption. Player switching is not password protection. Other apps on this same web origin may access this storage. The offline copy of the app holds only its own files, never your scores.</p></div>
    </section>
    <section class="card row danger">
      <span class="row-icon" aria-hidden="true">🏁</span>
      <div class="row-text"><h2>Finish the challenge</h2><p>Erase saved names, photos and results from this browser. Downloaded CSVs, original photos and backups must be deleted separately.</p></div>
      <button class="danger-button" data-action="reset">End &amp; delete</button>
    </section>`
}

function renderSheet() {
  const now = today()
  const date = sheetDate
  const viewer = showingOpponent ? 1 - activePlayer : activePlayer
  const own = !showingOpponent
  const target = targetForDate(game, date)
  const log = game.logs[viewer][date] || { water: 0, weight: '' }
  const locked = isLocked(game, date, viewer, now)
  const editable = own && canEdit(game, date, viewer, now)
  const requested = own && hasRequest(game, viewer, date)
  const other = escapeHtml(game.players[1 - activePlayer].name)
  const [statusClass, statusText] =
    date === now
      ? ['open', 'Today · this day locks at midnight']
      : !locked
        ? ['open', '🔓 Unlocked by approval']
        : requested
          ? ['wait', `⏳ Unlock requested. ${other} can approve it in More.`]
          : ['wait', '🔒 Locked. This day closed at midnight.']
  const glasses = Array.from({ length: target }, (_, index) => {
    const filled = index < (log.water || 0)
    return `<button class="glass-btn${filled ? ' filled' : ''}" data-action="water" data-date="${date}" data-glass="${index + 1}"${editable ? '' : ' disabled'} aria-pressed="${filled}" aria-label="Glass ${index + 1} for ${formatDate(date)}">${miniGlassSvg()}</button>`
  }).join('')
  const weight = own
    ? `<label class="weight-field"><span>Weight (optional)</span><span class="weight-input"><input data-action="weight" data-date="${date}" type="number" min="0.1" step="any" inputmode="decimal" placeholder="kg" value="${escapeHtml(log.weight || '')}"${editable ? '' : ' disabled'} aria-label="Weight in kilograms for ${formatDate(date)}" /><span aria-hidden="true">kg</span></span></label>`
    : ''
  const request = own && locked && !requested ? `<button class="secondary" data-action="request" data-date="${date}">Request unlock</button>` : ''
  return `<div class="backdrop${sheetOpened ? ' enter' : ''}" data-action="close-sheet"></div>
    <section class="sheet${sheetOpened ? ' enter' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="grabber" aria-hidden="true"></div>
      <div class="sheet-head">
        <div><h2 id="sheet-title" tabindex="-1">${formatLongDate(date)}</h2><p>Round ${roundForDate(game, date)} · Day ${roundDay(date)} · Goal ${target} glasses</p></div>
        <button class="close" data-action="close-sheet" aria-label="Close">✕</button>
      </div>
      <p class="sheet-status ${statusClass}">${statusText}</p>
      <div class="sheet-glasses">${glasses}<span class="sheet-count">${log.water || 0}/${target}</span></div>
      ${weight}${request}
      <button class="primary" data-action="close-sheet">Done</button>
    </section>`
}

function renderHandoff() {
  clearFeedback()
  document.documentElement.classList.remove('sheet-open')
  const next = game.players[1 - activePlayer]
  const current = game.players[activePlayer]
  app.innerHTML = `<main class="handoff" role="dialog" aria-modal="true" aria-labelledby="handoff-title">
    <div class="ripples" aria-hidden="true"><i class="ring"></i><i class="ring"></i><i class="ring"></i>${avatar(next, 'xl')}</div>
    <span class="eyebrow">PASS THE PHONE</span>
    <h1 id="handoff-title" tabindex="-1">Your turn,<br />${escapeHtml(next.name)}</h1>
    <p>${escapeHtml(current.name)}'s glasses are tucked away while you swap.</p>
    <p class="secret">🔒 ${escapeHtml(current.name)}'s scorecard is hidden</p>
    <button class="cta" data-action="handoff-confirm">I'm ${escapeHtml(next.name)} →</button>
    <button class="ghost" data-action="handoff-cancel">Back to ${escapeHtml(current.name)}</button>
  </main>`
  app.querySelector('#handoff-title').focus({ preventScroll: true })
  scrollTo(0, 0)
}

function afterWater(before, after, date) {
  const target = targetForDate(game, date)
  announce(`${after} of ${target} glasses logged for ${formatDate(date)}`)
  if (date === today() && before < target && after >= target) celebrate(activePlayer)
  else if (after > before) navigator.vibrate?.(10)
}

function openSheet(date, opener, weight = false) {
  sheetDate = date
  sheetOpened = true
  sheetOpener = opener
  focusWeight = weight
  render()
}

function closeSheet() {
  sheetDate = null
  render({ focusKey: sheetOpener })
}

function handleAction(control) {
  const { action, date } = control.dataset
  const now = today()
  const focusKey = focusKeyOf(control)
  if (TAB_ACTIONS.has(action)) {
    const changed = currentTab !== action
    if (action === 'home') showingOpponent = false
    if (action === 'leaderboard' && changed) fillTanks = true
    currentTab = action
    sheetDate = null
    render({ focusKey })
    if (changed) scrollTo(0, 0)
    return
  }
  switch (action) {
    case 'switch':
      handoff = true
      sheetDate = null
      render()
      return
    case 'handoff-confirm':
      activePlayer = 1 - activePlayer
      showingOpponent = false
      handoff = false
      render()
      scrollTo(0, 0)
      return
    case 'handoff-cancel':
      handoff = false
      render({ focusKey: keyFor('switch') })
      return
    case 'log': {
      if (showingOpponent || phase(game, now) !== 'active') return render()
      const before = water(game, activePlayer, now)
      const after = addGlass(game, activePlayer, now)
      save()
      render({ focusKey: after >= targetForDate(game, now) ? keyFor('undo') : focusKey })
      afterWater(before, after, now)
      return
    }
    case 'undo': {
      if (showingOpponent || phase(game, now) !== 'active') return render()
      const after = removeGlass(game, activePlayer, now)
      save()
      render({ focusKey: after ? focusKey : keyFor('log') })
      announce(`${after} of ${targetForDate(game, now)} glasses logged for today`)
      return
    }
    case 'day':
      openSheet(date, focusKey)
      return
    case 'weigh':
      openSheet(now, focusKey, true)
      return
    case 'close-sheet':
      closeSheet()
      return
    case 'water': {
      if (showingOpponent || !canEdit(game, date, activePlayer, now)) return render({ focusKey })
      const before = water(game, activePlayer, date)
      const after = toggleGlass(game, activePlayer, date, Number(control.dataset.glass))
      save()
      render({ focusKey })
      afterWater(before, after, date)
      return
    }
    case 'request':
      if (showingOpponent || !isLocked(game, date, activePlayer, now)) return render()
      requestUnlock(game, activePlayer, date)
      save()
      render()
      app.querySelector('#sheet-title')?.focus({ preventScroll: true })
      toast('Unlock requested', `Pass the phone to ${game.players[1 - activePlayer].name}. They can approve it in More.`)
      return
    case 'peek':
      if (roundForDate(game, now) === 2 || !usePeek(game, activePlayer)) return render()
      showingOpponent = true
      currentTab = 'home'
      save()
      render()
      scrollTo(0, 0)
      return
    case 'hide-opponent':
      showingOpponent = false
      render()
      return
    case 'approve': {
      const requester = Number(control.dataset.player)
      if (requester === activePlayer) return render()
      approveUnlock(game, requester, date)
      save()
      render()
      toast('Day unlocked 🔓', `${game.players[requester].name} can now update ${formatDate(date)}.`)
      return
    }
    case 'tide-round':
      tideRound = Number(control.dataset.round)
      render({ focusKey })
      return
    case 'download':
      downloadResults()
      return
    case 'share':
      shareLink()
      return
    case 'reset':
      if (!confirm('End this challenge and erase all saved results from this device?')) return
      localStorage.removeItem(STORAGE_KEY)
      game = null
      activePlayer = 0
      showingOpponent = false
      currentTab = 'home'
      tideRound = null
      sheetDate = null
      heroGlass = null
      renderSetup()
      scrollTo(0, 0)
  }
}

function handleWeight(input) {
  const { date } = input.dataset
  if (showingOpponent || !canEdit(game, date, activePlayer, today())) return render()
  if (!input.reportValidity()) return
  setWeight(game, activePlayer, date, input.value)
  if (!save()) return
  if (input.value) toast('Weight saved', `${formatWeight(input.value)} kg on ${formatDate(date)}, kept on this device only.`)
  else toast('Weight cleared', formatDate(date))
}

async function shrinkPhoto(file, size = 320) {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(size, side)
    canvas
      .getContext('2d')
      .drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function handlePhoto(input) {
  const file = input.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) return toast('That is not a photo', 'Please choose an image file.')
  if (file.size > 40 * 1024 * 1024) return toast('That photo is huge', 'Please choose an image under 40 MB.')
  try {
    const photo = await shrinkPhoto(file)
    const previous = game.players[activePlayer].photo
    game.players[activePlayer].photo = photo
    if (save()) toast('Looking good! 📸', 'Your photo is saved on this device only.')
    else game.players[activePlayer].photo = previous
    render()
  } catch {
    toast('Could not read that photo', 'Try a different image.')
  }
}

async function shareLink() {
  const url = new URL(location.pathname, location.origin).href
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Battle H2O', text: 'A two-player water challenge 💧', url })
      return
    } catch (error) {
      if (error?.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast('App link copied!', 'Scores stay on this device; they are not shared through the link.')
  } catch {
    prompt('Copy this app link. Scores stay on this device:', url)
  }
}

function downloadResults() {
  const blob = new Blob([resultsCsv(game)], { type: 'text/csv' })
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'battle-h2o-results.csv' })
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

function scheduleMidnight() {
  const next = new Date()
  next.setHours(24, 0, 1, 0)
  setTimeout(() => {
    if (game && !handoff) render()
    scheduleMidnight()
  }, next - new Date())
}

app.addEventListener('click', (event) => {
  const control = event.target.closest('[data-action]')
  if (!control || control.disabled || control.dataset.action === 'weight') return
  handleAction(control)
})

app.addEventListener('change', (event) => {
  if (event.target.matches('input[data-action="weight"]')) handleWeight(event.target)
  else if (event.target.matches('#photo-input')) handlePhoto(event.target)
})

app.addEventListener('submit', (event) => {
  if (event.target.id !== 'setup-form') return
  event.preventDefault()
  const form = new FormData(event.target)
  const names = [form.get('first').trim(), form.get('second').trim()]
  if (names.some((name) => !name)) {
    event.target.elements[names[0] ? 'second' : 'first'].focus()
    toast('Two nicknames needed', 'Please enter a name for both players.')
    return
  }
  game = createGame(names, form.get('start'))
  activePlayer = 0
  showingOpponent = false
  currentTab = 'home'
  tideRound = null
  save()
  navigator.storage?.persist?.().catch(() => {})
  render()
  scrollTo(0, 0)
})

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  if (sheetDate) closeSheet()
  else if (handoff) {
    handoff = false
    render({ focusKey: keyFor('switch') })
  }
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && game && !handoff && today() !== renderedDay) render()
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}))
}

render()
scheduleMidnight()
