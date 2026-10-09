<template>
  <div class="game">
    <h1>🏆 Таблиця множення — майстер</h1>

    <div class="statusbar">
      <span class="chip">⭐ {{ displayStars }}</span>
      <span class="chip">❌ {{ displayErrors }}</span>
      <span class="chip">Вивчено: {{ displayDone }} / {{ displayTotal }}</span>
      <span class="chip ver-chip">Варіант:</span>
      <button
        class="btn small ver"
        :class="{ active: version === 1 }"
        @click="switchVersion(1)"
      >1</button>
      <button
        class="btn small ver"
        :class="{ active: version === 2 }"
        @click="switchVersion(2)"
      >2</button>
      <button class="btn small" @click="showSettings = true">⚙️ Рівні</button>
      <button class="btn small" @click="resetCurrent">🔄 Спочатку</button>
    </div>

    <p class="hint">{{ hintText }}</p>

    <!-- ================= ВАРІАНТ 1: дві таблиці чисел + результати ================= -->
    <div v-if="version === 1" class="tables">
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

    <!-- ================= ВАРІАНТ 2: одна змішана таблиця, трійки в будь-якому порядку ================= -->
    <div v-else class="tables">
      <div class="table-card mix-card">
        <h2>Знайди трійку: множник × множник = відповідь</h2>
        <div class="grid mix-grid">
          <button
            v-for="cell in visibleMixCells"
            :key="cell.id"
            class="cell mix-cell"
            :class="mixCellClass(cell)"
            :style="mixCellStyle(cell)"
            @click="pickMix(cell)"
          >{{ cell.value }}</button>
        </div>
        <p v-if="resultsLeft === 0" class="win-note">
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

/* ---------------- shared state ---------------- */
const activeLevels = ref([2, 3, 4, 5])
const levelsTmp = ref([...activeLevels.value])
const showSettings = ref(false)

const version = ref(1)   // 1 = класика (дві таблиці), 2 = одна змішана таблиця

const colorIdx = ref(0)
const feedback = ref({ type: '', text: '' })
const confetti = ref([])
const resolveLock = ref(false)

/* ---------------- version 1 state ---------------- */
const leftSel = ref(null)
const rightSel = ref(null)
const removed = ref(new Set())       // mastered result values
const resultFlash = ref(null)        // value of just-picked (correct) result
const wrongFlash = ref(null)         // value of wrong-picked result

const stars = ref(0)
const errors = ref(0)

/* ---------------- version 2 state ---------------- */
const mixCells = ref([])             // [{ id, value }] — анонімні числа, перемішані
const pendingResults = ref([])       // добутки, які ще треба розв'язати (по одному на рівність)
const usedTriplets = ref(new Set())  // вже вивчені трійки «a×b=p» (множники сортовані):
                                     // дзеркальна трійка (3,2,6) = та сама, що (2,3,6) —
                                     // повторно НЕ зараховується, щоб не зіпсувати решту варіантів
const mixSel = ref([])               // ids of currently selected cells (up to 3)
const mixFlash = ref([])             // ids of the correct triplet being celebrated
const mixWrong = ref([])             // ids of the wrong triplet being shaken

const v2Stars = ref(0)
const v2Errors = ref(0)

/* ---------------- palette ----------------
   Every completed pick is marked with the SAME color.
   The color rotates each round so matches stay visually distinct. */
const COLORS = [
  { bg: '#ffd6e0', border: '#ff8fab', text: '#8a1c3b' }, // pink
  { bg: '#d0ebff', border: '#74c0fc', text: '#1864ab' }, // blue
  { bg: '#d3f9d8', border: '#69db7c', text: '#2b8a3e' }, // green
  { bg: '#fff3bf', border: '#ffd43b', text: '#997a00' }, // yellow
  { bg: '#efe7ff', border: '#b197fc', text: '#5f3dc4' }, // violet
  { bg: '#ffe8cc', border: '#ffa94d', text: '#d9480f' }, // orange
]

/* ---------------- derived (shared) ---------------- */
const activeNumbers = computed(() =>
  [...activeLevels.value].sort((a, b) => a - b)
)

const allResults = computed(() => {
  const s = new Set()
  for (const a of activeNumbers.value)
    for (const b of activeNumbers.value) s.add(a * b)
  return [...s].sort((x, y) => x - y)
})

const curColor = computed(() => COLORS[colorIdx.value % COLORS.length])

const displayStars = computed(() => (version.value === 1 ? stars.value : v2Stars.value))
const displayErrors = computed(() => (version.value === 1 ? errors.value : v2Errors.value))
const displayDone = computed(() =>
  version.value === 1 ? removed.value.size : v2Equations.value.length - pendingResults.value.length
)
const displayTotal = computed(() =>
  version.value === 1 ? allResults.value.length : v2Equations.value.length
)

const hintText = computed(() =>
  version.value === 1
    ? 'Обери число зліва, потім справа, а потім знайди відповідь!'
    : 'Усі числа перемішані! Обери три числа: два множники та їхній добуток — у будь-якому порядку.'
)

/* ---------------- derived (version 1) ---------------- */
const availableResults = computed(() =>
  allResults.value.filter(r => !removed.value.has(r))
)

const bothPicked = computed(() => leftSel.value !== null && rightSel.value !== null)
const target = computed(() =>
  bothPicked.value ? leftSel.value * rightSel.value : null
)

/* ---------------- derived (version 2) ----------------
   Рівняння = рівень × 2..9, БЕЗ дзеркал: 6×3 — та сама трійка, що 3×6,
   тому тримаємо лише один порядок (a < b, коли обидва множники — рівні).
   Для рівнів 3, 6, 9 добуток 18 дають рівно ДВІ трійки: (3,6) та (9,2) —
   дві плитки «18» на дошці. */
const v2Range = Array.from({ length: 8 }, (_, i) => i + 2)

const v2Equations = computed(() => {
  const eqs = []
  const levels = new Set(activeNumbers.value)
  for (const a of activeNumbers.value)
    for (const b of v2Range) {
      // дзеркало вже є як (b, a): пропускаємо старший порядок
      if (a > b && levels.has(b)) continue
      eqs.push({ a, b, p: a * b })
    }
  return eqs
})

const resultsLeft = computed(() => pendingResults.value.length)

const visibleMixCells = computed(() => {
  if (resultsLeft.value === 0) return []        // все вивчено — дошка порожня
  return mixCells.value
})

/* ---------------- selection (version 1) ---------------- */
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

/* ---------------- selection (version 2) ---------------- */
function pickMix(cell) {
  if (resolveLock.value) return
  const idx = mixSel.value.indexOf(cell.id)
  if (idx >= 0) {                          // toggle off
    mixSel.value.splice(idx, 1)
    return
  }
  if (mixSel.value.length >= 3) return     // three are already picked
  mixSel.value.push(cell.id)
  feedbackMsg('', '')
  if (mixSel.value.length === 3) evaluateMix()
}

function evaluateMix() {
  const sel = mixSel.value.map(id => mixCells.value.find(c => c.id === id))
  // трійка валідна «на льоту»: два найменші числа — множники, найбільше — добуток,
  // і хоча б один множник належить обраним рівням (інший — співмножник 2..10)
  const vals = sel.map(c => c.value).sort((a, b) => a - b)
  const levels = activeNumbers.value
  const ok = vals.length === 3 &&
             vals[0] * vals[1] === vals[2] &&
             (levels.includes(vals[0]) || levels.includes(vals[1]))

  // дзеркальний захист: цю трійку вже вивчено (у будь-якому порядку множників)
  // — не зараховуємо повторно, плитки залишаються на місці
  const key = `${vals[0]}x${vals[1]}=${vals[2]}`
  if (ok && usedTriplets.value.has(key)) {
    feedbackMsg('info', `${vals[0]} × ${vals[1]} = ${vals[2]} уже вивчено — обери іншу трійку 🙂`)
    mixSel.value = []
    return
  }

  if (ok) {
    mixFlash.value = sel.map(c => c.id)
    v2Stars.value++
    resolveLock.value = true
    feedbackMsg('ok', `Так! ${vals[0]} × ${vals[1]} = ${vals[2]} 🎉`)
    playTone(true)
    burstConfetti()
    setTimeout(() => {
      // дзеркальна трійка (3,2,6) = та сама, що (2,3,6): зберігаємо в сортованому
      // вигляді й зараховуємо ОДИН раз — зникають усі рівності цієї трійки
      const key = `${vals[0]}x${vals[1]}=${vals[2]}`
      if (!usedTriplets.value.has(key)) {
        usedTriplets.value = new Set([...usedTriplets.value, key])
        const eqs = v2Equations.value.filter(e =>
          e.p === vals[2] && ((e.a === vals[0] && e.b === vals[1]) || (e.a === vals[1] && e.b === vals[0])))
        for (const eq of eqs) {
          const i = pendingResults.value.indexOf(eq)
          if (i >= 0) pendingResults.value.splice(i, 1)
        }
      }
      const gone = new Set(sel.map(c => c.id))
      mixCells.value = mixCells.value.filter(c => !gone.has(c.id))  // усі три плитки зникають
      ensureSolvable()
      mixFlash.value = []
      mixSel.value = []
      colorIdx.value++
      resolveLock.value = false
      feedbackMsg('', '')
    }, 750)
  } else {
    mixWrong.value = sel.map(c => c.id)
    v2Errors.value++
    feedbackMsg('err', 'Не збіглося! Потрібно: два множники та їхній добуток 🙂')
    playTone(false)
    setTimeout(() => {
      mixWrong.value = []
      mixSel.value = []
    }, 450)
  }
}

/* ---------------- version 2 table generation ----------------
   Дошка — анонімний перемішаний пул чисел: множники 2..9 (плюс самі рівні)
   та добутки рівнянь. Жодних позначок «результат» — трійка перевіряється
   «на льоту»: два найменші числа мають дати найбільше.
   Кожна рівність (рівень × 2..9) дає на дошці СВОЮ плитку-добуток:
   для рівнів 3, 6, 9 на дошці є ТРИ плитки «18» (3×6, 6×3, 9×2).
   Плитки-множники stocking так само на рівність:
   - плитка v потрібна один раз на кожну рівність, де v бере участь,
   - плюс одна додаткова для квадрата (2×2=4 з'їдає дві плитки «2» одразу). */
function buildMixCells() {
  const eqs = v2Equations.value
  const levels = activeNumbers.value
  const values = [...new Set([...v2Range, ...activeNumbers.value])]
  const cells = []
  for (const v of values) {
    let count = 0
    for (const e of eqs) {
      if (e.a === v) count++           // v — рівень цієї рівності
      else if (e.b === v) count++      // v — співмножник
    }
    // квадрат: 2×2=4 — одна рівність споживає ДВІ плитки «2»
    if (levels.includes(v) && eqs.some(e => e.a === v && e.b === v)) count++
    for (let i = 0; i < count; i++) {
      cells.push({ id: `F${v}_${i}`, value: v })
    }
  }
  for (const e of eqs) {
    cells.push({ id: `R${e.a}x${e.b}`, value: e.p })
  }
  mixCells.value = shuffle(cells)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = 0; i < a.length; i++) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function freePairExists(p) {
  const free = mixCells.value.filter(c => !mixSel.value.includes(c.id))
  const levels = activeNumbers.value
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const x = free[i].value, y = free[j].value
      if (x * y !== p) continue
      // додаткова перевірка валідності, як в evaluateMix:
      // хоча б один множник належить обраним рівням
      if (!(levels.includes(x) || levels.includes(y))) continue
      // дзеркальний захист: пару, яку вже вивчено, не рахуємо доступною
      const key = `${Math.min(x, y)}x${Math.max(x, y)}=${p}`
      if (usedTriplets.value.has(key)) continue
      return true
    }
  }
  return false
}

/* Гарантія розв'язності: після кожного розв'язаного добутку перевіряємо,
   що кожна нерозв'язана рівність має на дошці свою плитку-добуток і вільну
   пару множників. Якщо ні (плитку з'їли як співмножник, або пару витратили)
   — тихо повертаємо бракуючі плитки на дошку. */
function ensureSolvable() {
  for (const e of v2Equations.value) {
    if (!pendingResults.value.some(pe => pe.a === e.a && pe.b === e.b)) continue
    // плитка-добуток цієї рівності може бути з'їдена як множник — повертаємо
    if (!mixCells.value.some(c => c.value === e.p)) {
      mixCells.value = shuffle([
        ...mixCells.value,
        { id: `R${e.a}x${e.b}_${Date.now()}_${Math.random().toString(36).slice(2)}`, value: e.p },
      ])
    }
    if (freePairExists(e.p)) continue
    // повертаємо пару рівня + співмножника
    mixCells.value = shuffle([
      ...mixCells.value,
      { id: `F${e.a}_${Date.now()}_${Math.random().toString(36).slice(2)}`, value: e.a },
      { id: `F${e.b}_${Date.now()}_${Math.random().toString(36).slice(2)}`, value: e.b },
    ])
  }
}

/* ---------------- visuals (version 1) ---------------- */
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

/* ---------------- visuals (version 2) ---------------- */
function mixCellClass(cell) {
  return {
    selected: mixSel.value.includes(cell.id),
    flash: mixFlash.value.includes(cell.id),
    wrong: mixWrong.value.includes(cell.id),
  }
}

function mixCellStyle(cell) {
  if (mixFlash.value.includes(cell.id)) {
    return { background: curColor.value.bg, borderColor: curColor.value.border, color: curColor.value.text }
  }
  if (mixSel.value.includes(cell.id)) {
    return { borderColor: curColor.value.border, boxShadow: `inset 0 0 0 3px ${curColor.value.bg}` }
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

function switchVersion(v) {
  if (version.value === v) return
  version.value = v
  feedbackMsg('', '')
  // перший вхід у v2, якщо дошку ще не будували для поточних рівнів
  if (v === 2 && mixCells.value.length === 0 && resultsLeft.value === 0 && v2Equations.value.length > 0 && pendingResults.value.length === 0) {
    pendingResults.value = [...v2Equations.value]
    buildMixCells()
  }
}

function applyLevels() {
  if (levelsTmp.value.length === 0) return
  activeLevels.value = [...levelsTmp.value].sort((a, b) => a - b)
  showSettings.value = false
  resetAll()
  resetMix()
}

function resetAll() {
  leftSel.value = null
  rightSel.value = null
  removed.value = new Set()
  resultFlash.value = null
  wrongFlash.value = null
  stars.value = 0
  errors.value = 0
  colorIdx.value = 0
  confetti.value = []
  resolveLock.value = false
  feedbackMsg('', '')
}

function resetMix() {
  mixSel.value = []
  mixFlash.value = []
  mixWrong.value = []
  usedTriplets.value = new Set()
  pendingResults.value = [...v2Equations.value]
  v2Stars.value = 0
  v2Errors.value = 0
  buildMixCells()
}

function resetCurrent() {
  if (version.value === 1) resetAll()
  else resetMix()
}

onMounted(() => {
  levelsTmp.value = [...activeLevels.value]
  resetMix()
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
.ver-chip { border-style: dashed; }
.btn {
  border: none; border-radius: 10px; padding: 8px 16px;
  background: #74c0fc; color: #fff; font-weight: 700; cursor: pointer;
  font-size: 0.95rem; font-family: inherit;
}
.btn:hover { filter: brightness(0.95); }
.btn.small { padding: 4px 10px; font-size: 0.85rem; }
.btn.ghost { background: #e9ecef; color: #495057; }
.btn.ver { background: #e9ecef; color: #495057; border-radius: 999px; min-width: 34px; }
.btn.ver.active { background: #74c0fc; color: #fff; }
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
.mix-grid {
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  width: min(720px, 86vw);
}

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

.mix-card { display: flex; flex-direction: column; align-items: center; }
.mix-cell { height: 52px; font-size: 1.3rem; }
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
