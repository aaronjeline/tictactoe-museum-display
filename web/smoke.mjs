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
await page.waitForSelector('text=Learning Tic-Tac-Toe by Watching')
await page.screenshot({ path: `${SHOT_DIR}/01-initial.png` })

// stat card should show the final checkpoint with zero mistakes
const stat = await page.locator('.stat-card').innerText()
console.log('STAT CARD (final):', stat.replace(/\n/g, ' | '))

// play a game as X at full strength: center, then respond to the net
const cells = page.locator('.board .cell')
await cells.nth(4).click()
await page.waitForTimeout(1300) // mid-deliberation
await page.screenshot({ path: `${SHOT_DIR}/01b-thinking.png` })
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

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console/page errors')
await browser.close()
