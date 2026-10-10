import { computed } from 'vue'
import {
  activeLevels, levelsTmp, showSettings, version, feedback,
} from './gameStore.js'
import {
  stars, errors, removed, allResults, resetClassic,
} from './versionClassic.js'
import {
  v2Stars, v2Errors, pendingResults, v2Equations,
  ensureBoardBuilt, resetMixed,
} from './versionMixed.js'

/* ============================================================
   Controls + header stats that span BOTH game versions.
   Depends on gameStore and both version modules, but is
   imported only by App.vue (and the tests).
   ============================================================ */

/* ---------------- header stats (per active version) ---------------- */
export const displayStars = computed(() => (version.value === 1 ? stars.value : v2Stars.value))
export const displayErrors = computed(() => (version.value === 1 ? errors.value : v2Errors.value))
export const displayDone = computed(() =>
  version.value === 1 ? removed.value.size : v2Equations.value.length - pendingResults.value.length
)
export const displayTotal = computed(() =>
  version.value === 1 ? allResults.value.length : v2Equations.value.length
)

export const hintText = computed(() =>
  version.value === 1
    ? 'Обери число зліва, потім справа, а потім знайди відповідь!'
    : 'Усі числа перемішані! Обери три числа: два множники та їхній добуток — у будь-якому порядку.'
)

/* ---------------- controls ---------------- */
export function switchVersion(v) {
  if (version.value === v) return
  version.value = v
  feedback.value = { type: '', text: '' }
  // first entry into v2, if the board hasn't been built for the current levels yet
  if (v === 2) ensureBoardBuilt()
}

export function applyLevels() {
  if (levelsTmp.value.length === 0) return
  activeLevels.value = [...levelsTmp.value].sort((a, b) => a - b)
  showSettings.value = false
  resetClassic()
  resetMixed()
}

export function resetCurrent() {
  if (version.value === 1) resetClassic()
  else resetMixed()
}

/* full reset: default levels + both versions' progress
   (module state is a singleton — used on app start and between test mounts) */
export function resetGameState() {
  activeLevels.value = [2, 3, 4, 5]
  levelsTmp.value = [...activeLevels.value]
  showSettings.value = false
  version.value = 1
  resetClassic()
  resetMixed()
}
