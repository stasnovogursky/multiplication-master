<template>
  <!-- ================= VARIANT 1: two number tables + results ================= -->
  <div class="tables">
    <div class="table-card">
      <h2>Число 1</h2>
      <div class="grid numbers-grid">
        <button
          v-for="n in allFactorNumbers"
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
          v-for="n in allFactorNumbers"
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
</template>

<script setup>
import {
  factorNumbers as allFactorNumbers,
} from './gameStore.js'
import {
  availableResults,
  cellClass, cellStyle, resultClass, resultStyle,
  selectLeft, selectRight, selectResult,
} from './versionClassic.js'
</script>

<style scoped>
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
.numbers-grid { grid-template-columns: repeat(1, 72px); }
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

@keyframes pop {
  50% { transform: scale(1.18); }
}
@keyframes shake {
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

@media (max-width: 760px) {
  .numbers-grid { grid-template-columns: repeat(1, 56px); }
  .results-grid { grid-template-columns: repeat(4, 56px); }
  .cell { height: 46px; font-size: 1.15rem; }
  .sign { display: none; }
}
</style>
