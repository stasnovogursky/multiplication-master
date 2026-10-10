<template>
  <!-- ================= VARIANT 2: one mixed table, triplets in any order ================= -->
  <div class="tables">
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
</template>

<script setup>
import {
  visibleMixCells, resultsLeft,
  mixCellClass, mixCellStyle, pickMix,
} from './versionMixed.js'
</script>

<style scoped>
.tables {
  display: flex; gap: 14px; justify-content: center; align-items: flex-start;
  flex-wrap: wrap;
}
.table-card {
  background: #fff; border-radius: 16px; padding: 12px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.08);
}
.table-card h2 { text-align: center; margin: 0 0 10px; font-size: 1.05rem; color: #555; }

.grid { display: grid; gap: 8px; }
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
.cell.flash { animation: pop 0.25s ease; }
.cell.wrong { animation: shake 0.4s ease; background: #ffc9c9 !important; border-color: #fa5252 !important; color: #c92a2a !important; }

.mix-card { display: flex; flex-direction: column; align-items: center; }
.mix-cell { height: 52px; font-size: 1.3rem; }
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
</style>
