// Drives the exhibit in headless Chrome: loads the page, plays a game at
// the final checkpoint, scrubs to the untrained checkpoint, screenshots.
import { chromium } from 'playwright'

const URL = process.env.URL ?? 'http://localhost:5173'
const SHOT_DIR = '/tmp/exhibit-shots'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

await page.goto(URL)
await page.waitForSelector('text=Learning Tic-Tac-Toe')
await page.screenshot({ path: `${SHOT_DIR}/01-initial.png` })

// stat card should show the final checkpoint with zero mistakes
const stat = await page.locator('.stat-card').innerText()
console.log('STAT CARD (final):', stat.replace(/\n/g, ' | '))

// play a game as X at full strength: center, then respond to the net
const cells = page.locator('.board .cell')
await cells.nth(4).click()
await page.waitForTimeout(1300) // mid-deliberation
await page.screenshot({ path: `${SHOT_DIR}/01b-thinking.png` })
// the tally is only on screen while the output stage is revealed — poll for it
await page.waitForFunction(
  () => (document.querySelector('.vote-tally')?.textContent ?? '').includes('neuron'),
  { timeout: 5000 },
)
console.log('VOTE TALLY (mid-thinking):', (await page.locator('.vote-tally').innerText()).trim())
await page.screenshot({ path: `${SHOT_DIR}/01c-vote-tally.png` })
// the net deliberates ~3s per move; wait for our turn or game end
async function waitTurn() {
  await page.waitForTimeout(250) // let "thinking…" appear (or the game end)
  await page.waitForFunction(
    () => {
      const s = document.querySelector('.status')?.textContent ?? ''
      return !s.includes('thinking')
    },
    { timeout: 20000 },
  )
}
const gameOver = (s) => /win|draw/i.test(s)
await waitTurn()
await page.screenshot({ path: `${SHOT_DIR}/02-after-net-reply.png` })
console.log('STATUS after reply:', await page.locator('.status').innerText())
console.log('CAPTION:', await page.locator('.caption').innerText())

// make two more legal moves (first empty cell each time) to see flow
for (let i = 0; i < 2; i++) {
  const idx = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.board .cell')]
    return btns.findIndex((b) => !b.disabled && b.textContent?.trim() === '')
  })
  if (idx < 0) break
  await cells.nth(idx).click()
  await waitTurn()
}
await page.screenshot({ path: `${SHOT_DIR}/03-midgame.png` })
console.log('STATUS midgame:', await page.locator('.status').innerText())

// --- Level 1: attribution overlay ---
const whyBtn = page.locator('.caption-row .why')
if (await whyBtn.isVisible()) {
  console.log('WHY button:', await whyBtn.innerText())
  await whyBtn.click()
  const badges = await page.locator('.attr-badge').count()
  console.log('attribution badges shown:', badges)
  await page.screenshot({ path: `${SHOT_DIR}/03b-attribution.png` })
  await whyBtn.click() // hide
} else {
  console.log('WHY button: not visible (unexpected)')
}

// --- Level 2: tap an h1 neuron ---
const canvas = page.locator('.network-canvas')
const box = await canvas.boundingBox()
const pitch = Math.min(box.width * 0.028, box.height * 0.1)
await page.mouse.click(box.x + box.width * 0.4 + 0.5 * pitch, box.y + box.height * 0.52 + 0.5 * pitch)
await page.waitForSelector('.neuron-card', { timeout: 3000 })
console.log('NEURON CARD:', (await page.locator('.neuron-card').innerText()).replace(/\n/g, ' | '))
await page.screenshot({ path: `${SHOT_DIR}/03c-neuron-card.png` })
await page.locator('.neuron-card .close').click()

// --- second layer: tap h2[37], the strongest win detector (row 4, col 5) ---
await page.mouse.click(box.x + box.width * 0.66 + 1.5 * pitch, box.y + box.height * 0.52 + 0.5 * pitch)
await page.waitForSelector('.neuron-card', { timeout: 5000 })
console.log('H2 CARD:', (await page.locator('.neuron-card').innerText()).replace(/\n/g, ' | '))
await page.screenshot({ path: `${SHOT_DIR}/03e-h2-card.png` })
await page.locator('.neuron-card .close').click()

// --- Level 3: detector gallery at gen15 ---
await page.locator('.mode-toggle').click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOT_DIR}/03d-gallery-gen15.png` })
await page.locator('.mode-toggle').click()

// scrub to the untrained checkpoint — game resets, weights morph
await page.locator('.scrubber input[type=range]').fill('0')
await page.waitForTimeout(900) // let the morph finish
console.log('STAT CARD (untrained):', (await page.locator('.stat-card').innerText()).replace(/\n/g, ' | '))
await page.screenshot({ path: `${SHOT_DIR}/04-untrained.png` })

// board should be reset
const marks = await page.evaluate(
  () => [...document.querySelectorAll('.board .cell')].filter((b) => b.textContent?.trim() !== '').length,
)
console.log('marks on board after scrub (expect 0):', marks)

// play a full game against the untrained net (first empty cell each turn);
// it must reach a result without errors
for (let i = 0; i < 5; i++) {
  if (gameOver(await page.locator('.status').innerText())) break
  const idx = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.board .cell')]
    return btns.findIndex((b) => !b.disabled && b.textContent?.trim() === '')
  })
  if (idx < 0) break
  await cells.nth(idx).click()
  await waitTurn()
}
console.log('STATUS end of untrained game:', await page.locator('.status').innerText())
await page.screenshot({ path: `${SHOT_DIR}/05-untrained-game.png` })

// --- Level 3 again: gallery should be noise at the untrained checkpoint ---
await page.locator('.mode-toggle').click()
await page.waitForTimeout(800) // morph settles
await page.screenshot({ path: `${SHOT_DIR}/06-gallery-untrained.png` })
await page.locator('.mode-toggle').click()

// --- Level 4: skill chart click scrubs ---
console.log('SKILL LEGEND (untrained):', await page.locator('.skill-legend').innerText())
await page.locator('.skill-chart .hit').nth(8).click() // -> Generation 7
await page.waitForTimeout(700)
console.log('STAT after chart click:', await page.locator('.stat-card .stat-title').innerText())
console.log('SKILL LEGEND (gen 7):', await page.locator('.skill-legend').innerText())
await page.screenshot({ path: `${SHOT_DIR}/07-skill-chart.png` })

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console/page errors')
await browser.close()
