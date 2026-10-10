import { ref, computed } from 'vue'
import {
  activeNumbers, factorNumbers, curColor, resolveLock, colorIdx,
  feedbackMsg, burstConfetti, playTone, resetShared,
} from './gameStore.js'

/* ============================================================
   Version 1 — classic: two factor tables + a results table.
   All state and logic of this version live here, isolated from
   version 2 (see versionMixed.js) so each can evolve freely.
   ============================================================ */

/* ---------------- version 1 state ---------------- */
export const leftSel = ref(null)
export const rightSel = ref(null)
export const removed = ref(new Set())       // mastered result values
export const resultFlash = ref(null)        // value of just-picked (correct) result
export const wrongFlash = ref(null)         // value of wrong-picked result

export const stars = ref(0)
export const errors = ref(0)

/* v1: left/right tables always show ALL factors 2..9 regardless of selected levels;
   only the result table follows the level selection. */
export const allResults = computed(() => {
  const s = new Set()
  // v1: results are level × any factor 2..9
  for (const a of activeNumbers.value)
    for (const b of factorNumbers) s.add(a * b)
  return [...s].sort((x, y) => x - y)
})

export const availableResults = computed(() =>
  allResults.value.filter(r => !removed.value.has(r))
)

export const bothPicked = computed(() => leftSel.value !== null && rightSel.value !== null)
const target = computed(() =>
  bothPicked.value ? leftSel.value * rightSel.value : null
)

/* ---------------- selection (version 1) ---------------- */
export function selectLeft(n) {
  if (resolveLock.value) return
  if (leftSel.value === n) { leftSel.value = null; return }      // toggle off
  leftSel.value = n
  feedbackMsg('', '')
}

export function selectRight(n) {
  if (resolveLock.value) return
  if (rightSel.value === n) { rightSel.value = null; return }    // toggle off
  const product = (leftSel.value ?? n) * n
  if (leftSel.value !== null && removed.value.has(product)) {
    feedbackMsg('info', `Супер! ${leftSel.value} × ${n} = ${product} уже вивчено — обери інший приклад 🙂`)
    return
  }
  // a pair where neither factor belongs to the selected levels — its product
  // isn't on the board, so hint right away instead of leaving a dead end
  if (leftSel.value !== null &&
      !activeNumbers.value.includes(leftSel.value) &&
      !activeNumbers.value.includes(n)) {
    feedbackMsg('info', `${leftSel.value} × ${n} не входить у вибрані рівні — хоча б один множник має бути з них 🙂`)
    return
  }
  rightSel.value = n
  feedbackMsg('', '')
}

export function selectResult(r) {
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

/* ---------------- visuals (version 1) ---------------- */
export function cellClass(n, side) {
  const sel = side === 'left' ? leftSel.value : rightSel.value
  return {
    selected: sel === n,
    paired: bothPicked.value && sel === n,
    otherSide: bothPicked.value && sel !== n,
  }
}

export function cellStyle(n, side) {
  const sel = side === 'left' ? leftSel.value : rightSel.value
  if (sel === n && bothPicked.value) {
    return { background: curColor.value.bg, borderColor: curColor.value.border, color: curColor.value.text }
  }
  if (sel === n) {
    return { borderColor: curColor.value.border, boxShadow: `inset 0 0 0 3px ${curColor.value.bg}` }
  }
  return {}
}

export function resultClass(r) {
  return {
    flash: resultFlash.value === r,
    wrong: wrongFlash.value === r,
  }
}

export function resultStyle(r) {
  if (resultFlash.value === r) {
    return { background: curColor.value.bg, borderColor: curColor.value.border, color: curColor.value.text }
  }
  return {}
}

/* ---------------- reset (version 1) ---------------- */
export function resetClassic() {
  leftSel.value = null
  rightSel.value = null
  removed.value = new Set()
  resultFlash.value = null
  wrongFlash.value = null
  stars.value = 0
  errors.value = 0
  resetShared()
}
