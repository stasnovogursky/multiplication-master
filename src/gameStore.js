import { ref, computed } from 'vue'

/* ============================================================
   Shared game state — used by BOTH game versions.
   Version-specific state and logic live in:
     - versionClassic.js  (variant 1: two factor tables + results)
     - versionMixed.js    (variant 2: one mixed table, triplets)
   ============================================================ */

/* ---------------- shared state ---------------- */
export const activeLevels = ref([2, 3, 4, 5])
export const levelsTmp = ref([...activeLevels.value])
export const showSettings = ref(false)

export const version = ref(1)   // 1 = classic (two factor tables), 2 = one mixed table

export const colorIdx = ref(0)
export const feedback = ref({ type: '', text: '' })
export const confetti = ref([])
export const resolveLock = ref(false)

/* all factor numbers 2..9 — factor tables (v1) and the mixed pool (v2) */
export const factorNumbers = Array.from({ length: 8 }, (_, i) => i + 2)

export const activeNumbers = computed(() =>
  [...activeLevels.value].sort((a, b) => a - b)
)

/* ---------------- palette ----------------
   Every completed pick is marked with the SAME color.
   The color rotates each round so matches stay visually distinct. */
export const COLORS = [
  { bg: '#ffd6e0', border: '#ff8fab', text: '#8a1c3b' }, // pink
  { bg: '#d0ebff', border: '#74c0fc', text: '#1864ab' }, // blue
  { bg: '#d3f9d8', border: '#69db7c', text: '#2b8a3e' }, // green
  { bg: '#fff3bf', border: '#ffd43b', text: '#997a00' }, // yellow
  { bg: '#efe7ff', border: '#b197fc', text: '#5f3dc4' }, // violet
  { bg: '#ffe8cc', border: '#ffa94d', text: '#d9480f' }, // orange
]

export const curColor = computed(() => COLORS[colorIdx.value % COLORS.length])

/* ---------------- helpers shared by both versions ---------------- */
export function feedbackMsg(type, text) {
  feedback.value = { type, text }
}

export function burstConfetti() {
  const colors = ['#ff8fab', '#74c0fc', '#69db7c', '#ffd43b', '#b197fc', '#ffa94d']
  confetti.value = Array.from({ length: 36 }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    color: colors[i % colors.length],
  }))
  setTimeout(() => { confetti.value = [] }, 2600)
}

let audioCtx = null
export function playTone(good) {
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

/* reset the pieces of shared state that belong to a single round */
export function resetShared() {
  colorIdx.value = 0
  confetti.value = []
  resolveLock.value = false
  feedbackMsg('', '')
}
