import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../src/App.vue'

// jsdom has no AudioContext — the app guards this internally, silence it anyway
vi.stubGlobal('AudioContext', undefined)

async function mountApp() {
  const w = mount(App)
  await flushPromises()
  return w
}

// all .cell buttons inside the single mixed table (visible order == mixCells order)
function mixCells(w) { return w.findAll('.mix-cell') }

// click a specific tile by id (DOM order == mixCells order; visibleMixCells == mixCells)
async function clickTile(w, id) {
  const idx = w.vm.mixCells.findIndex(c => c.id === id)
  expect(idx, `tile ${id} should be visible`).toBeGreaterThanOrEqual(0)
  await mixCells(w)[idx].trigger('click')
  await flushPromises()
}

function freeTiles(w, v) {
  return w.vm.mixCells.filter(c => c.value === v && !w.vm.mixSel.includes(c.id))
}

function tileIdForProduct(w, p) {
  const t = w.vm.mixCells.find(c => c.value === p)
  return t ? t.id : null
}

async function waitResolve(ms = 900) {
  await new Promise(r => setTimeout(r, ms))
  await flushPromises()
}

async function gotoV2(w) {
  await w.findAll('.btn.ver').find(b => b.text() === '2').trigger('click')
  await flushPromises()
}

describe('Multiplication Master — version 2 (single mixed table)', () => {
  let w
  beforeEach(async () => {
    w = await mountApp()
  })

  it('starts in version 1 and switches to version 2 via the header button', async () => {
    expect(w.vm.version).toBe(1)
    expect(mixCells(w).length).toBe(0)
    await gotoV2(w)
    expect(w.vm.version).toBe(2)
    expect(mixCells(w).length).toBeGreaterThan(0)
    expect(w.find('.hint').text()).toContain('перемішані')
  })

  it('board is anonymous numbers: no result marking anywhere', async () => {
    await gotoV2(w)
    // every tile renders the same: plain .mix-cell, no special class
    for (const c of mixCells(w)) {
      expect(c.classes().includes('result')).toBe(false)
    }
    // products and factor values are indistinguishable in markup
    const texts = w.vm.mixCells.map(c => String(c.value))
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) expect(texts).toContain(String(n))
    // ×10 as a multiplier is gone: 8×10=80 and 9×10=90 are not on the board
    expect(texts).not.toContain('80')
    expect(texts).not.toContain('90')
    const prods = new Set()
    for (const a of [2, 3, 4, 5]) for (const b of [2, 3, 4, 5, 6, 7, 8, 9]) prods.add(a * b)
    for (const p of prods) expect(texts).toContain(String(p))
  })

  it('solves a triplet in "weird" order: result first, then factors', async () => {
    await gotoV2(w)
    await clickTile(w, tileIdForProduct(w, 6))           // product first!
    await clickTile(w, freeTiles(w, 3)[0].id)            // then factors
    await clickTile(w, freeTiles(w, 2)[0].id)

    expect(w.vm.mixFlash.length).toBe(3)
    await waitResolve()

    expect(w.vm.v2Stars).toBe(1)
    // mirror-aware: solving (2,3,6) retires BOTH 2×3 and 3×2 — none remains
    expect(w.vm.pendingResults.filter(e => e.p === 6).length).toBe(0)
    // the three picked tiles are gone (same-value tiles may remain as co-factors);
    // capture them from the selection before the resolve timeout clears mixSel
    const pickedIds = w.vm.mixSel.concat()
    await waitResolve()
    expect(w.vm.mixCells.filter(c => pickedIds.includes(c.id)).length).toBe(0)
  })

  it('validates on the fly: sorted two smallest multiply to the largest', async () => {
    await gotoV2(w)
    // pick tiles that make 2×3=6 — clicking in a different size order
    await clickTile(w, tileIdForProduct(w, 6))
    await clickTile(w, freeTiles(w, 2)[0].id)
    await clickTile(w, freeTiles(w, 3)[0].id)
    expect(w.vm.mixFlash.length).toBe(3)
    await waitResolve()
    expect(w.vm.pendingResults.filter(e => e.p === 6).length).toBe(0)
  })

  it('rejects a wrong triplet: error++, tiles stay, selection cleared', async () => {
    await gotoV2(w)
    await clickTile(w, freeTiles(w, 2)[0].id)
    await clickTile(w, freeTiles(w, 3)[0].id)
    // 2×3=6, pick 8 instead
    await clickTile(w, tileIdForProduct(w, 8))

    expect(w.vm.v2Errors).toBe(1)
    expect(w.vm.mixWrong.length).toBe(3)
    expect(w.find('.feedback').classes().join(' ')).toContain('err')

    await waitResolve(600)
    expect(w.vm.pendingResults.length).toBe(32)
    expect(w.vm.mixSel.length).toBe(0)
    // both 6 and 8 still on the board
    expect(tileIdForProduct(w, 6)).not.toBe(null)
    expect(tileIdForProduct(w, 8)).not.toBe(null)
  })

  it('pairs like 4×6=24 rejected when level 4 not selected', async () => {
    await gotoV2(w)
    w.vm.levelsTmp = [3]
    await w.vm.applyLevels()
    await flushPromises()

    // 4 and 6 exist as co-factor tiles, but 4×6=24 is not part of row 3
    await clickTile(w, freeTiles(w, 4)[0].id)
    await clickTile(w, freeTiles(w, 6)[0].id)
    await clickTile(w, tileIdForProduct(w, 24))

    expect(w.vm.v2Errors).toBe(1)
    expect(w.vm.pendingResults.length).toBe(8)
  })

  it('toggles a picked cell back off', async () => {
    await gotoV2(w)
    const id = freeTiles(w, 2)[0].id
    await clickTile(w, id)
    expect(w.vm.mixSel).toEqual([id])
    await clickTile(w, id)
    expect(w.vm.mixSel).toEqual([])
  })

  it('locks input while a correct triplet resolves', async () => {
    await gotoV2(w)
    await clickTile(w, freeTiles(w, 2)[0].id)
    await clickTile(w, freeTiles(w, 2)[0].id)   // second "2" tile (2×2=4)
    await clickTile(w, tileIdForProduct(w, 4))

    expect(w.vm.resolveLock).toBe(true)
    const before = w.vm.mixSel.length
    await clickTile(w, freeTiles(w, 3)[0].id)
    expect(w.vm.mixSel.length).toBe(before) // unchanged: locked
    await waitResolve()
    expect(w.vm.mixSel.length).toBe(0)
    expect(w.vm.pendingResults.filter(e => e.p === 4).length).toBe(0)
  })

  it('level settings rebuild the mixed table (7, 8)', async () => {
    await gotoV2(w)
    w.vm.levelsTmp = [7, 8]
    await w.vm.applyLevels()
    await flushPromises()

    const texts = w.vm.mixCells.map(c => String(c.value))
    for (const n of ['7', '8']) expect(texts).toContain(n)
    for (const p of ['49', '56', '64', '72']) expect(texts).toContain(p)
    expect(texts).not.toContain('80')  // ×10 більше немає
    expect(texts).not.toContain('11')
    // per-equation model: 16 result tiles (one per equation), only 56 duplicated
    const results = w.vm.mixCells.filter(c => c.value >= 14).map(c => c.value)
    expect(results.length).toBe(16)
    expect(new Set(results).size).toBe(15)
    expect(results.filter(v => v === 56).length).toBe(2)
  })

  it('solved triplets remove ALL three tiles; board empties with a win note (level 2)', async () => {
    await gotoV2(w)
    w.vm.levelsTmp = [2]
    await w.vm.applyLevels()
    await flushPromises()

    for (const p of [4, 6, 8, 10, 12, 14, 16, 18]) {
      // co-factor first — any order; look up second tile after selecting first
      const q = p / 2
      await clickTile(w, freeTiles(w, q)[0].id)
      await clickTile(w, freeTiles(w, 2)[0].id)
      const rid = tileIdForProduct(w, p)
      expect(rid, `product ${p} on the board`).toBeTruthy()
      const picked = [...w.vm.mixSel, rid]
      await clickTile(w, rid)
      await waitResolve()
      // the three picked tiles are gone (same-value co-factor tiles may remain)
      expect(w.vm.mixCells.filter(c => picked.includes(c.id)).length).toBe(0)
    }
    expect(w.vm.pendingResults.length).toBe(0)
    expect(w.vm.v2Stars).toBe(8)
    expect(mixCells(w).length).toBe(0)
    expect(w.find('.win-note').exists()).toBe(true)
  }, 45000)

  it('any clearing order stays solvable (brute force, level 3)', async () => {
    await gotoV2(w)
    w.vm.levelsTmp = [3]
    await w.vm.applyLevels()
    await flushPromises()

    const prods = [6, 9, 12, 15, 18, 21, 24, 27].sort(() => Math.random() - 0.5)
    for (const p of prods) {
      const free = () => w.vm.mixCells.filter(c => !w.vm.mixSel.includes(c.id))
      let first = null, second = null
      outer:
      for (const a of free()) {
        for (const b of free()) {
          if (a.id === b.id) continue
          // valid triple: one factor must be the selected level (3), other 2..10
          const vals = [a.value, b.value].sort((x, y) => x - y)
          if (!vals.includes(3)) continue
          const other = vals[0] === 3 ? vals[1] : vals[0]
          if (other < 2 || other > 10) continue
          if (a.value * b.value === p) { first = a; second = b; break outer }
        }
      }
      expect(first, `valid pair for ${p} must be available`).toBeTruthy()
      await clickTile(w, first.id)
      await clickTile(w, second.id)
      const rid = tileIdForProduct(w, p)
      expect(rid).toBeTruthy()
      await clickTile(w, rid)
      await waitResolve()
    }
    expect(w.vm.pendingResults.length).toBe(0)
    expect(mixCells(w).length).toBe(0)
    expect(w.find('.win-note').exists()).toBe(true)
  }, 45000)

  it('has enough tiles to finish every equation in any clearing order (levels 2..5)', async () => {
    await gotoV2(w)
    // solve every pending equation (mirrors retire together), random-ish order,
    // looping until nothing solvable remains — the board must empty completely
    let solves = 0
    for (let guard = 0; guard < 200; guard++) {
      const free = () => w.vm.mixCells.filter(c => !w.vm.mixSel.includes(c.id))
      let found = null
      outer:
      for (const e of w.vm.pendingResults) {
        for (const a of free()) {
          for (const b of free()) {
            if (a.id === b.id) continue
            const vals = [a.value, b.value].sort((x, y) => x - y)
            if (vals[0] * vals[1] !== e.p) continue
            if (!(w.vm.activeLevels.includes(vals[0]) || w.vm.activeLevels.includes(vals[1]))) continue
            if (w.vm.usedTriplets.has(`${vals[0]}x${vals[1]}=${e.p}`)) continue  // blocked repeat
            const rid = w.vm.mixCells.find(c => c.value === e.p && !w.vm.mixSel.includes(c.id))
            if (!rid) continue
            found = [a.id, b.id, rid.id]
            break outer
          }
        }
      }
      if (!found) break
      await clickTile(w, found[0])
      await clickTile(w, found[1])
      await clickTile(w, found[2])
      await waitResolve()
      solves++
    }
    expect(w.vm.pendingResults.length).toBe(0)
    expect(mixCells(w).length).toBe(0)
    expect(w.vm.v2Stars).toBe(solves)
    expect(solves).toBeGreaterThan(0)
    expect(w.find('.win-note').exists()).toBe(true)
  }, 90000)

  it('blocks a repeated triplet: (2,3,6) solved once never counts again', async () => {
    await gotoV2(w)
    // solve 2×3=6 once (weird order: result first)
    await clickTile(w, tileIdForProduct(w, 6))
    await clickTile(w, freeTiles(w, 3)[0].id)
    await clickTile(w, freeTiles(w, 2)[0].id)
    await waitResolve()
    expect(w.vm.usedTriplets.has('2x3=6')).toBe(true)

    // try the same triplet again, mirrored order (3,2,6) — must be blocked
    const starsBefore = w.vm.v2Stars
    const errorsBefore = w.vm.v2Errors
    const boardBefore = w.vm.mixCells.map(c => c.id)
    await clickTile(w, freeTiles(w, 3)[0].id)
    await clickTile(w, freeTiles(w, 2)[0].id)
    await clickTile(w, freeTiles(w, 6)[0].id)
    // info feedback (not err, not ok), no score change, tiles stay on the board
    expect(w.find('.feedback').classes().join(' ')).toContain('info')
    expect(w.vm.v2Stars).toBe(starsBefore)
    expect(w.vm.v2Errors).toBe(errorsBefore)
    expect(w.vm.mixCells.map(c => c.id)).toEqual(boardBefore)
    expect(w.vm.mixSel.length).toBe(0)
    // mirror-aware: the solve retires BOTH 2×3 and 3×2 → 32 − 2 = 30 pending
    expect(w.vm.pendingResults.length).toBe(30)
  }, 45000)

  it('duplicate products appear once per equation (3, 6, 9 → three 18-tiles)', async () => {
    await gotoV2(w)
    w.vm.levelsTmp = [3, 6, 9]
    await w.vm.applyLevels()
    await flushPromises()

    const texts = w.vm.mixCells.map(c => String(c.value))
    // three equations give 18: 3×6, 6×3, 9×2 → three "18" tiles on the board
    expect(texts.filter(t => t === '18').length).toBe(3)
    // equations with p ≥ 12: 3×4..3×9 (6) + 6×2..6×9 (8) + 9×2..9×9 (8) = 22 tiles
    expect(w.vm.mixCells.filter(c => c.value >= 12).length).toBe(22)
    // 3×6 and 6×3 are two separate equations → two "3" and two "6" factor tiles
    expect(texts.filter(t => t === '3').length).toBeGreaterThanOrEqual(2)
    expect(texts.filter(t => t === '6').length).toBeGreaterThanOrEqual(2)

    // solve 18 twice via different equations: 9×2 and 3×6 — both must work
    for (const pair of [[9, 2], [3, 6]]) {
      const [x, y] = pair
      await clickTile(w, freeTiles(w, x)[0].id)
      await clickTile(w, freeTiles(w, y)[0].id)
      const rid = w.vm.mixCells.find(c => c.value === 18 && !w.vm.mixSel.includes(c.id))
      expect(rid, `free 18 tile for ${x}×${y}`).toBeTruthy()
      const picked = [...w.vm.mixSel, rid.id]
      await clickTile(w, rid.id)
      await waitResolve()
      expect(w.vm.mixCells.filter(c => picked.includes(c.id)).length).toBe(0)
    }
    // after two solves, one 18 remains on the board
    expect(texts_after_one_left(w)).toBe(1)
  }, 45000)

  function texts_after_one_left(w) {
    return w.vm.mixCells.filter(c => c.value === 18).length
  }

  it('version switch keeps each version progress separate; Спочатку resets current', async () => {
    // play one round in v1
    const leftCells = w.findAll('.table-card').at(0).findAll('button.cell')
    const rightCells = w.findAll('.table-card').at(1).findAll('button.cell')
    leftCells.find(c => c.text() === '2').trigger('click')
    rightCells.find(c => c.text() === '3').trigger('click')
    await flushPromises()
    w.findAll('.result-cell').find(c => c.text() === '6').trigger('click')
    await flushPromises()
    await waitResolve()
    expect(w.vm.stars).toBe(1)

    // switch to v2 — fresh board, v2 score is separate
    await gotoV2(w)
    expect(w.vm.v2Stars).toBe(0)
    expect(w.vm.displayStars).toBe(0)

    // score a point in v2, then reset — header shows v2 reset, v1 untouched
    await clickTile(w, freeTiles(w, 2)[0].id)
    await clickTile(w, freeTiles(w, 5)[0].id)
    await clickTile(w, tileIdForProduct(w, 10))
    await waitResolve()
    expect(w.vm.v2Stars).toBe(1)

    await w.findAll('.btn').find(b => b.text().includes('Спочатку')).trigger('click')
    await flushPromises()
    expect(w.vm.v2Stars).toBe(0)
    expect(w.vm.pendingResults.length).toBe(32)
    // v1 progress untouched
    expect(w.vm.stars).toBe(1)
    expect(w.vm.removed.size).toBe(1)
  })
})
