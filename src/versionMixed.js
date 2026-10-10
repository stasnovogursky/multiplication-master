import { ref, computed } from 'vue'
import {
  activeNumbers, factorNumbers, curColor, resolveLock, colorIdx,
  feedbackMsg, burstConfetti, playTone, resetShared,
} from './gameStore.js'

/* ============================================================
   Version 2 — mixed table: anonymous shuffled tiles, triplets
   picked in any order. State and logic isolated from version 1
   (see versionClassic.js) so each can evolve freely.
   ============================================================ */

/* ---------------- version 2 state ---------------- */
export const mixCells = ref([])             // [{ id, value }] — anonymous shuffled numbers
export const pendingResults = ref([])       // products still to solve (one per equation)
export const usedTriplets = ref(new Set())  // already-learned «a×b=p» triplets (factors sorted):
                                            // a mirrored triplet (3,2,6) = same as (2,3,6) —
                                            // NOT counted again, to keep the other variants intact
export const mixSel = ref([])               // ids of currently selected cells (up to 3)
export const mixFlash = ref([])             // ids of the correct triplet being celebrated
export const mixWrong = ref([])             // ids of the wrong triplet being shaken

export const v2Stars = ref(0)
export const v2Errors = ref(0)

const v2Range = factorNumbers

/* ---------------- derived (version 2) ----------------
   Equations = level × 2..9, WITHOUT mirrors: 6×3 is the same triplet as 3×6,
   so we keep only one order (a < b when both factors are levels).
   For levels 3, 6, 9 the product 18 comes from exactly TWO triplets: (3,6) and (9,2) —
   two «18» tiles on the board. */
export const v2Equations = computed(() => {
  const eqs = []
  const levels = new Set(activeNumbers.value)
  for (const a of activeNumbers.value)
    for (const b of v2Range) {
      // mirror already exists as (b, a): skip the higher order
      if (a > b && levels.has(b)) continue
      eqs.push({ a, b, p: a * b })
    }
  return eqs
})

export const resultsLeft = computed(() => pendingResults.value.length)

export const visibleMixCells = computed(() => {
  if (resultsLeft.value === 0) return []        // all learned — board is empty
  return mixCells.value
})

/* ---------------- selection (version 2) ---------------- */
export function pickMix(cell) {
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
  // triplet is valid «on the fly»: the two smallest numbers are the factors,
  // the largest is the product, and at least one factor is a selected level
  // (the other is a co-factor 2..10)
  const vals = sel.map(c => c.value).sort((a, b) => a - b)
  const levels = activeNumbers.value
  const ok = vals.length === 3 &&
             vals[0] * vals[1] === vals[2] &&
             (levels.includes(vals[0]) || levels.includes(vals[1]))

  // mirror guard: this triplet is already learned (in any factor order)
  // — don't count it again, the tiles stay in place
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
      // mirrored triplet (3,2,6) = same as (2,3,6): stored sorted and counted
      // exactly ONCE — all equations of this triplet disappear
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
      mixCells.value = mixCells.value.filter(c => !gone.has(c.id))  // all three tiles vanish
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
   The board is an anonymous shuffled pool of numbers: factors 2..9 (plus the
   levels themselves) and the equation products. No «result» labels — a triplet
   is checked «on the fly»: the two smallest numbers must produce the largest.
   Each equation (level × 2..9) gets its OWN product tile on the board:
   for levels 3, 6, 9 there are THREE «18» tiles on the board (3×6, 6×3, 9×2).
   Factor tiles are stocked per equation as well:
   - tile v is needed once for every equation where v participates,
   - plus one extra for a square (2×2=4 consumes two «2» tiles at once). */
export function buildMixCells() {
  const eqs = v2Equations.value
  const levels = activeNumbers.value
  const values = [...new Set([...v2Range, ...activeNumbers.value])]
  const cells = []
  for (const v of values) {
    let count = 0
    for (const e of eqs) {
      if (e.a === v) count++           // v is the level of this equation
      else if (e.b === v) count++      // v is a co-factor
    }
    // square: 2×2=4 — a single equation consumes TWO «2» tiles
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
      // extra validity check, as in evaluateMix:
      // at least one factor must belong to the selected levels
      if (!(levels.includes(x) || levels.includes(y))) continue
      // mirror guard: an already-learned pair doesn't count as available
      const key = `${Math.min(x, y)}x${Math.max(x, y)}=${p}`
      if (usedTriplets.value.has(key)) continue
      return true
    }
  }
  return false
}

/* Solvability guarantee: after each solved product we check that every
   unsolved equation still has its product tile on the board and a free
   pair of factors. If not (the tile was consumed as a co-factor, or the
   pair was spent) — silently restore the missing tiles to the board. */
function ensureSolvable() {
  for (const e of v2Equations.value) {
    if (!pendingResults.value.some(pe => pe.a === e.a && pe.b === e.b)) continue
    // the product tile of this equation may have been consumed as a factor — restore it
    if (!mixCells.value.some(c => c.value === e.p)) {
      mixCells.value = shuffle([
        ...mixCells.value,
        { id: `R${e.a}x${e.b}_${Date.now()}_${Math.random().toString(36).slice(2)}`, value: e.p },
      ])
    }
    if (freePairExists(e.p)) continue
    // restore the level + co-factor pair
    mixCells.value = shuffle([
      ...mixCells.value,
      { id: `F${e.a}_${Date.now()}_${Math.random().toString(36).slice(2)}`, value: e.a },
      { id: `F${e.b}_${Date.now()}_${Math.random().toString(36).slice(2)}`, value: e.b },
    ])
  }
}

/* ---------------- visuals (version 2) ---------------- */
export function mixCellClass(cell) {
  return {
    selected: mixSel.value.includes(cell.id),
    flash: mixFlash.value.includes(cell.id),
    wrong: mixWrong.value.includes(cell.id),
  }
}

export function mixCellStyle(cell) {
  if (mixFlash.value.includes(cell.id)) {
    return { background: curColor.value.bg, borderColor: curColor.value.border, color: curColor.value.text }
  }
  if (mixSel.value.includes(cell.id)) {
    return { borderColor: curColor.value.border, boxShadow: `inset 0 0 0 3px ${curColor.value.bg}` }
  }
  return {}
}

/* ---------------- reset (version 2) ---------------- */
export function resetMix() {
  mixSel.value = []
  mixFlash.value = []
  mixWrong.value = []
  usedTriplets.value = new Set()
  pendingResults.value = [...v2Equations.value]
  v2Stars.value = 0
  v2Errors.value = 0
  buildMixCells()
}

/* first entry into v2: build the board for the current levels if it isn't built yet */
export function ensureBoardBuilt() {
  if (mixCells.value.length === 0 && resultsLeft.value === 0 &&
      v2Equations.value.length > 0 && pendingResults.value.length === 0) {
    resetMix()
  }
}

export function resetMixed() {
  resetMix()
}
