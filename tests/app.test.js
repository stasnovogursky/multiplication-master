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

function leftCells(w) { return w.findAll('.table-card').at(0).findAll('button.cell') }
function rightCells(w) { return w.findAll('.table-card').at(1).findAll('button.cell') }
function resultCells(w) { return w.findAll('.result-cell') }

async function pick(w, a, b) {
  leftCells(w).find(c => c.text() === String(a)).trigger('click')
  rightCells(w).find(c => c.text() === String(b)).trigger('click')
  await flushPromises()
  // click the correct result
  const target = String(a * b)
  const cell = resultCells(w).find(c => c.text() === target)
  expect(cell, `result ${target} should be visible`).toBeTruthy()
  cell.trigger('click')
  await flushPromises()
  // wait out the 750ms resolve animation
  await new Promise(r => setTimeout(r, 800))
  await flushPromises()
}

describe('Multiplication Master', () => {
  let w
  beforeEach(async () => {
    w = await mountApp()
  })

  it('renders two factor tables and a results table', () => {
    const cards = w.findAll('.table-card')
    expect(cards.length).toBe(3)
    // v1: factor tables always show ALL numbers 2..9, regardless of levels
    expect(leftCells(w).length).toBe(8)
    expect(rightCells(w).length).toBe(8)
    // products = levels(2..5) × factors(2..9), unique: {4,6,8,...,45} = 22
    expect(resultCells(w).length).toBe(22)
  })

  it('marks left+right+result with the SAME color on a correct pick', async () => {
    leftCells(w).find(c => c.text() === '3').trigger('click')
    rightCells(w).find(c => c.text() === '4').trigger('click')
    await flushPromises()

    const L = leftCells(w).find(c => c.text() === '3')
    const R = rightCells(w).find(c => c.text() === '4')
    // both selected -> both get the round color as background
    expect(L.attributes('style')).toContain(R.attributes('style')?.split(';')[0])

    const T = String(3 * 4)
    resultCells(w).find(c => c.text() === T).trigger('click')
    await flushPromises()

    // while flashing, the result cell carries the same bg color as the two factors
    const resultStyle = resultCells(w).find(c => c.text() === T).attributes('style')
    const factorStyle = leftCells(w).find(c => c.text() === '3').attributes('style')
    expect(resultStyle).toContain(factorStyle?.split(';')[0])

    // after the resolve animation the result cell is gone
    await new Promise(r => setTimeout(r, 900))
    await flushPromises()
    expect(resultCells(w).map(c => c.text())).not.toContain(T)
  })

  it('removes a correct result from the table', async () => {
    await pick(w, 2, 3)
    const texts = resultCells(w).map(c => c.text())
    expect(texts).not.toContain('6')
    expect(w.vm.stars).toBe(1)
  })

  it('shows feedback and keeps the wrong result on a wrong pick', async () => {
    leftCells(w).find(c => c.text() === '2').trigger('click')
    rightCells(w).find(c => c.text() === '5').trigger('click')
    await flushPromises()

    resultCells(w).find(c => c.text() === '9').trigger('click') // wrong (2*5=10)
    await flushPromises()

    expect(resultCells(w).map(c => c.text())).toContain('10')
    expect(resultCells(w).map(c => c.text())).toContain('9')
    expect(w.vm.errors).toBe(1)
    expect(w.find('.feedback').classes().join(' ')).toContain('err')
  })

  it('locks input while a correct pick resolves', async () => {
    leftCells(w).find(c => c.text() === '2').trigger('click')
    rightCells(w).find(c => c.text() === '2').trigger('click')
    await flushPromises()
    resultCells(w).find(c => c.text() === '4').trigger('click')
    await flushPromises()
    // during the 750ms resolve window a second pick is ignored
    expect(w.vm.resolveLock).toBe(true)
    leftCells(w).find(c => c.text() === '3').trigger('click')
    await flushPromises()
    expect(w.vm.leftSel).toBe(2) // unchanged: input locked
    await new Promise(r => setTimeout(r, 900))
    await flushPromises()
    expect(w.vm.leftSel).toBe(null) // cleared after resolve
  })

  it('re-selecting the same factor toggles it off', async () => {
    const c = leftCells(w).find(c => c.text() === '4')
    c.trigger('click'); await flushPromises()
    expect(w.vm.leftSel).toBe(4)
    c.trigger('click'); await flushPromises()
    expect(w.vm.leftSel).toBe(null)
  })

  it('keeps results unique when levels overlap (4x4=16 already there)', async () => {
    const texts = resultCells(w).map(c => c.text())
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('level settings change tables and results', async () => {
    w.vm.levelsTmp = [7, 8]
    await w.vm.applyLevels()
    await flushPromises()
    // v1: factor tables are unaffected by levels; results = levels × all factors 2..9
    expect(leftCells(w).map(c => c.text())).toEqual(['2', '3', '4', '5', '6', '7', '8', '9'])
    // 7×{2..9} ∪ 8×{2..9}, unique & sorted (81=9×9 is NOT included — 9 is not a level)
    expect(resultCells(w).map(c => c.text())).toEqual(
      ['14', '16', '21', '24', '28', '32', '35', '40', '42', '48', '49', '56', '63', '64', '72'])
  })

  it('finishing all results shows the win note', async () => {
    // levels 2..5 × factors 2..9 -> 22 unique products; play them all
    const done = []
    outer:
    for (const a of [2, 3, 4, 5]) {
      for (const b of [2, 3, 4, 5, 6, 7, 8, 9]) {
        const p = a * b
        if (done.includes(p)) continue
        done.push(p)
        const before = resultCells(w).length
        leftCells(w).find(c => c.text() === String(a)).trigger('click')
        rightCells(w).find(c => c.text() === String(b)).trigger('click')
        await flushPromises()
        const cell = resultCells(w).find(c => c.text() === String(p))
        if (!cell) { // may already be removed via a different factor pair
          expect(resultCells(w).length).toBe(before)
          continue outer
        }
        cell.trigger('click')
        await flushPromises()
        // wait out the resolve timeout
        await new Promise(r => setTimeout(r, 800))
      }
    }
    await flushPromises()
    expect(resultCells(w).length).toBe(0)
    expect(w.find('.win-note').exists()).toBe(true)
    expect(w.vm.stars).toBe(22)
  }, 30000)
})
