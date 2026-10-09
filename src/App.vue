<template>
  <div class="game">
    <h1>🏆 Таблиця множення — майстер</h1>

    <div class="statusbar">
      <span class="chip">⭐ {{ stars }}</span>
      <span class="chip">❌ {{ errors }}</span>
      <span class="chip">Вивчено: {{ removed.size }} / {{ allResults.length }}</span>
      <button class="btn small" @click="showSettings = true">⚙️ Рівні</button>
      <button class="btn small" @click="resetAll">🔄 Спочатку</button>
    </div>

    <p class="hint">Обери число зліва, потім справа, а потім знайди відповідь!</p>

    <div class="tables">
      <div class="table-card">
        <h2>Число 1</h2>
        <div class="grid numbers-grid">
          <button
            v-for="n in activeNumbers"
            :key="'L' + n"
            class="cell"
            :class="cellClass(n, 'left')"
            :style="cellStyle(n, 'left')"
            @click="selectLeft(n)"
          >{{ n }}</button>
        </div>
      </div>

      <div class="sign">×</div>

      <div class="table-card">
        <h2>Число 2</h2>
        <div class="grid numbers-grid">
          <button
            v-for="n in activeNumbers"
            :key="'R' + n"
            class="cell"
            :class="cellClass(n, 'right')"
            :style="cellStyle(n, 'right')"
            @click="selectRight(n)"
          >{{ n }}</button>
        </div>
      </div>

      <div class="sign">=</div>

      <div class="table-card results-card">
        <h2>Результат</h2>
        <div class="grid results-grid">
          <button
            v-for="r in availableResults"
            :key="r"
            class="cell result-cell"
            :class="resultClass(r)"
            :style="resultStyle(r)"
            @click="selectResult(r)"
          >{{ r }}</button>
        </div>
        <p v-if="availableResults.length === 0" class="win-note">
          🎉 Все вивчено! Ти чемпіон!
        </p>
      </div>
    </div>

    <div class="feedback" :class="feedback.type" v-if="feedback.text">{{ feedback.text }}</div>

    <div class="confetti-wrap" v-if="confetti.length">
      <div
        v-for="(c, i) in confetti"
        :key="i"
        class="confetti"
        :style="{ left: c.x + '%', animationDelay: c.delay + 's', background: c.color }"
      ></div>
    </div>

    <div class="overlay" v-if="showSettings" @click.self="showSettings = false">
      <div class="panel">
        <h2>Обрати таблиці</h2>
        <div class="checks">
          <label v-for="n in 8" :key="n" class="check">
            <input type="checkbox" :value="n + 1" v-model="levelsTmp" />
            {{ n + 1 }}
          </label>
        </div>
        <p v-if="levelsTmp.length === 0" class="warn">Обери хоча б одну таблицю!</p>
        <div class="panel-actions">
          <button class="btn" :disabled="levelsTmp.length === 0" @click="applyLevels">Зберегти</button>
          <button class="btn ghost" @click="showSettings = false">Скасувати</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

/* ---------------- state ---------------- */
const activeLevels = ref([2, 3, 4, 5])
const levelsTmp = ref([...activeLevels.value])
const showSettings = ref(false)

const leftSel = ref(null)
const rightSel = ref(null)
const removed = ref(new Set())       // mastered result values
const resultFlash = ref(null)        // value of just-picked (correct) result
const wrongFlash = ref(null)         // value of wrong-picked result
const resolveLock = ref(false)

const stars = ref(0)
const errors = ref(0)
const colorIdx = ref(0)

const feedback = ref({ type: '', text: '' })
const confetti = ref([])

/* ---------------- palette ----------------
   Every completed pick (left + right + result) is marked with the SAME color.
   The color rotates each round so matches stay visually distinct. */
const COLORS = [
  { bg: '#ffd6e0', border: '#ff8fab', text: '#8a1c3b' }, // pink
  { bg: '#d0ebff', border: '#74c0fc', text: '#1864ab' }, // blue
  { bg: '#d3f9d8', border: '#69db7c', text: '#2b8a3e' }, // green
  { bg: '#fff3bf', border: '#ffd43b', text: '#997a00' }, // yellow
  { bg: '#efe7ff', border: '#b197fc', text: '#5f3dc4' }, // violet
  { bg: '#ffe8cc', border: '#ffa94d', text: '#d9480f' }, // orange
]

/* ---------------- derived ---------------- */
const activeNumbers = computed(() =>
  [...activeLevels.value].sort((a, b) => a - b)
)

const allResults = computed(() => {
  const s = new Set()
  for (const a of activeNumbers.value)
    for (const b of activeNumbers.value) s.add(a * b)
  return [...s].sort((x, y) => x - y)
})

const availableResults = computed(() =>
  allResults.value.filter(r => !removed.value.has(r))
)

const curColor = computed(() => COLORS[colorIdx.value % COLORS.length])
const bothPicked = computed(() => leftSel.value !== null && rightSel.value !== null)
const target = computed(() =>
  bothPicked.value ? leftSel.value * rightSel.value : null
)

/* ---------------- selection ---------------- */
function feedbackMsg(type, text) {
  feedback.value = { type, text }
}

function selectLeft(n) {
  if (resolveLock.value) return
  if (leftSel.value === n) { leftSel.value = null; return }      // toggle off
  leftSel.value = n
  feedbackMsg('', '')
}

function selectRight(n) {
  if (resolveLock.value) return
  if (rightSel.value === n) { rightSel.value = null; return }    // toggle off
  const product = (leftSel.value ?? n) * n
  if (leftSel.value !== null && removed.value.has(product)) {
    feedbackMsg('info', `Супер! ${leftSel.value} × ${n} = ${product} уже вивчено — обери інший приклад 🙂`)
    return
  }
  rightSel.value = n
  feedbackMsg('', '')
}

function selectResult(r) {
  if (resolveLock.value) return
  if (!bothPicked.value) {
    feedbackMsg('info', 'Спочатку обери число зліва і число справа!')
    return
  }
  if (r === target.value) {
    // correct: mark all three with the same color, then remove the result
    resultFlash.value = r
    stars.value++
    resolveLock.value = true
    feedbackMsg('ok', `Так! ${leftSel.value} × ${rightSel.value} = ${r} 🎉`)
    playTone(true)
    burstConfetti()
    setTimeout(() => {
      removed.value = new Set([...removed.value, r])
      leftSel.value = null
      rightSel.value = null
      resultFlash.value = null
      colorIdx.value++
      resolveLock.value = false
      feedbackMsg('', '')
    }, 750)
  } else {
    wrongFlash.value = r
    errors.value++
    feedbackMsg('err', `Не зовсім! Порахуй ще: ${leftSel.value} × ${rightSel.value} = ?`)
    playTone(false)
    setTimeout(() => { wrongFlash.value = null }, 450)
  }
}

/* ---------------- visuals ---------------- */
function cellClass(n, side) {
  const sel = side === 'left' ? leftSel.value : rightSel.value
  return {
    selected: sel === n,
    paired: bothPicked.value && sel === n,
    otherSide: bothPicked.value && sel !== n,
  }
}

function cellStyle(n, side) {
  const sel = side === 'left' ? leftSel.value : rightSel.value
  if (sel === n && bothPicked.value) {
    return { background: curColor.value.bg, borderColor: curColor.value.border, color: curColor.value.text }
  }
  if (sel === n) {
    return { borderColor: curColor.value.border, boxShadow: `inset 0 0 0 3px ${curColor.value.bg}` }
  }
  return {}
}

function resultClass(r) {
  return {
    flash: resultFlash.value === r,
    wrong: wrongFlash.value === r,
  }
}

function resultStyle(r) {
  if (resultFlash.value === r) {
    return { background: curColor.value.bg, borderColor: curColor.value.border, color: curColor.value.text }
  }
  return {}
}

/* ---------------- helpers ---------------- */
function burstConfetti() {
  const colors = ['#ff8fab', '#74c0fc', '#69db7c', '#ffd43b', '#b197fc', '#ffa94d']
  confetti.value = Array.from({ length: 36 }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    color: colors[i % colors.length],
  }))
  setTimeout(() => { confetti.value = [] }, 2600)
}

let audioCtx = null
function playTone(good) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.connect(g); g.connect(audioCtx.destination)
    o.type = 'sine'
    if (good) {
      o.frequency.setValueAtTime(660, audioCtx.currentTime)
      o.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12)
      g.gain.setValueAtTime(0.15, audioCtx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35)
      o.start(); o.stop(audioCtx.currentTime + 0.35)
    } else {
      o.frequency.setValueAtTime(220, audioCtx.currentTime)
      g.gain.setValueAtTime(0.12, audioCtx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25)
      o.start(); o.stop(audioCtx.currentTime + 0.25)
    }
  } catch { /* audio not available — game still works */ }
}

function applyLevels() {
  if (levelsTmp.value.length === 0) return
  activeLevels.value = [...levelsTmp.value].sort((a, b) => a - b)
  showSettings.value = false
  resetAll()
}

function resetAll() {
  leftSel.value = null
  rightSel.value = null
  removed.value = new Set()
  resultFlash.value = null
  wrongFlash.value = null
  resolveLock.value = false
  stars.value = 0
  errors.value = 0
  colorIdx.value = 0
  confetti.value = []
  feedbackMsg('', '')
}

onMounted(() => {
  levelsTmp.value = [...activeLevels.value]
})
</script>

<style scoped>
.game {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  font-family: 'Comic Sans MS', 'Segoe UI', system-ui, sans-serif;
  color: #333;
}
h1 { text-align: center; font-size: 1.6rem; margin: 8px 0 12px; }
.hint { text-align: center; color: #666; margin: 4px 0 14px; }

.statusbar {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
  align-items: center; margin-bottom: 12px;
}
.chip {
  background: #fff; border: 2px solid #e0e0e0; border-radius: 999px;
  padding: 4px 12px; font-weight: 600; font-size: 0.95rem;
}
.btn {
  border: none; border-radius: 10px; padding: 8px 16px;
  background: #74c0fc; color: #fff; font-weight: 700; cursor: pointer;
  font-size: 0.95rem; font-family: inherit;
}
.btn:hover { filter: brightness(0.95); }
.btn.small { padding: 4px 10px; font-size: 0.85rem; }
.btn.ghost { background: #e9ecef; color: #495057; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.tables {
  display: flex; gap: 14px; justify-content: center; align-items: flex-start;
  flex-wrap: wrap;
}
.sign { font-size: 2.2rem; font-weight: 800; align-self: center; color: #888; }

.table-card {
  background: #fff; border-radius: 16px; padding: 12px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.08);
}
.table-card h2 { text-align: center; margin: 0 0 10px; font-size: 1.05rem; color: #555; }

.grid { display: grid; gap: 8px; }
.numbers-grid { grid-template-columns: repeat(2, 72px); }
.results-grid { grid-template-columns: repeat(4, 72px); }

.cell {
  border: 2px solid #dee2e6; border-radius: 12px;
  padding: 0; height: 56px; font-size: 1.5rem; font-weight: 800;
  background: #f8f9fa; color: #343a40; cursor: pointer;
  font-family: inherit; transition: transform 0.08s, background 0.15s;
}
.cell:hover { transform: scale(1.06); }
.cell:active { transform: scale(0.95); }
.cell.selected { animation: pop 0.15s ease; }
.cell.otherSide { opacity: 0.75; }
.result-cell { height: 52px; font-size: 1.25rem; }

.cell.flash { animation: pop 0.25s ease; }
.cell.wrong { animation: shake 0.4s ease; background: #ffc9c9 !important; border-color: #fa5252 !important; color: #c92a2a !important; }

.results-card { min-width: 340px; }
.win-note { text-align: center; font-weight: 700; color: #2b8a3e; }

.feedback {
  text-align: center; margin-top: 14px; font-size: 1.1rem; font-weight: 700;
  padding: 8px 14px; border-radius: 10px; display: inline-block;
  width: 100%; box-sizing: border-box;
}
.feedback.ok  { color: #2b8a3e; background: #ebfbee; }
.feedback.err { color: #c92a2a; background: #fff5f5; }
.feedback.info{ color: #1864ab; background: #e7f5ff; }

.confetti-wrap { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 50; }
.confetti {
  position: absolute; top: -20px; width: 10px; height: 16px;
  border-radius: 3px; animation: fall 2.2s linear forwards;
}
@keyframes fall {
  to { transform: translateY(105vh) rotate(720deg); opacity: 0.8; }
}
@keyframes pop {
  50% { transform: scale(1.18); }
}
@keyframes shake {
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.35);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.panel {
  background: #fff; border-radius: 16px; padding: 20px 24px; min-width: 300px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
}
.panel h2 { margin-top: 0; }
.checks { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0; }
.check {
  display: flex; align-items: center; gap: 5px; font-size: 1.1rem; font-weight: 700;
  background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 10px; padding: 6px 12px;
  cursor: pointer;
}
.check input { width: 18px; height: 18px; }
.warn { color: #c92a2a; font-weight: 600; }
.panel-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }

@media (max-width: 760px) {
  .numbers-grid { grid-template-columns: repeat(4, 56px); }
  .results-grid { grid-template-columns: repeat(4, 56px); }
  .cell { height: 46px; font-size: 1.15rem; }
  .sign { display: none; }
}
</style>
