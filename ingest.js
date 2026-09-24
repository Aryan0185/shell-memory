import { readFileSync, writeFileSync } from 'node:fs'
import {
  loadModel, unloadModel, ragIngest, ragDeleteWorkspace, ragCloseWorkspace,
  EMBEDDINGGEMMA_300M_Q4_0
} from '@qvac/sdk'

const WORKSPACE = 'shell-memory'
const file = process.argv[2] || './demo_history.txt'

// Boring commands and anything that looks like a credential never get indexed.
const SKIP = /^(ls|cd|pwd|clear|exit|history)(\s|$)/
const SECRET = /(token|passw|secret|api[_-]?key|authorization|bearer)/i

function parseHistory(path) {
  const seen = new Map()
  let ts = null
  readFileSync(path, 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (/^#\d{9,11}$/.test(line)) { ts = Number(line.slice(1)); return } // bash HISTTIMEFORMAT
    if (line.length < 5 || SKIP.test(line) || SECRET.test(line)) { ts = null; return }
    const prev = seen.get(line)
    seen.set(line, { line: i + 1, ts, count: (prev?.count ?? 0) + 1 })
    ts = null
  })
  return seen
}

const seen = parseHistory(file)
const commands = [...seen.keys()]
console.log(`▸ ${commands.length} unique commands from ${file}`)
if (commands.length === 0) {
  console.error('✖ nothing to index')
  process.exit(1)
}

try {
  const modelId = await loadModel({ modelSrc: EMBEDDINGGEMMA_300M_Q4_0 })
  try { await ragDeleteWorkspace({ workspace: WORKSPACE }) } catch { /* first run */ }
  const result = await ragIngest({ modelId, workspace: WORKSPACE, documents: commands, chunk: false })
  console.log(`▸ indexed ${result.processed.length} commands`)
  await ragCloseWorkspace({ workspace: WORKSPACE })
  writeFileSync('./memory-index.json', JSON.stringify(Object.fromEntries(seen), null, 2))
  await unloadModel({ modelId })
  process.exit(0)
} catch (error) {
  console.error('✖', error)
  process.exit(1)
}
