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

    <KeepAlive>
      <VersionClassic v-if="version === 1" />
      <VersionMixed v-else />
    </KeepAlive>

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
import { onMounted } from 'vue'
import VersionClassic from './VersionClassic.vue'
import VersionMixed from './VersionMixed.vue'
import {
  activeLevels, levelsTmp, showSettings, version,
  feedback, confetti, resolveLock,
} from './gameStore.js'
import {
  displayStars, displayErrors, displayDone, displayTotal, hintText,
  switchVersion, applyLevels, resetCurrent,
} from './gameControls.js'
import {
  stars, errors, removed, leftSel,
} from './versionClassic.js'
import {
  mixCells, mixSel, mixFlash, mixWrong, pendingResults, usedTriplets,
  v2Stars, v2Errors, resetMixed,
} from './versionMixed.js'

onMounted(() => {
  levelsTmp.value = [...activeLevels.value]
  resetMixed()
})

/* exposed for the vitest suites: state now lives in shared modules,
   so the tests reach it through the shell's exposed proxy */
defineExpose({
  version,
  activeLevels, levelsTmp,
  stars, errors, removed, leftSel, resolveLock,
  mixCells, mixSel, mixFlash, mixWrong, pendingResults, usedTriplets,
  v2Stars, v2Errors, displayStars,
  applyLevels,
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
</style>
