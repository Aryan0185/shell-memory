import { readFileSync } from 'node:fs'
import {
  loadModel, unloadModel, ragSearch, ragCloseWorkspace, completion,
  EMBEDDINGGEMMA_300M_Q4_0, LLAMA_3_2_1B_INST_Q4_0
} from '@qvac/sdk'

const WORKSPACE = 'shell-memory'
const question = process.argv.slice(2).join(' ').trim()
if (!question) {
  console.error('Usage: node ask.js "your question"')
  process.exit(1)
}

let index
try {
  index = JSON.parse(readFileSync('./memory-index.json', 'utf8'))
} catch {
  console.error('✖ memory-index.json not found. Run: node ingest.js')
  process.exit(1)
}
const pkg = new URL('./node_modules/@qvac/sdk/package.json', import.meta.url)
const version = JSON.parse(readFileSync(pkg, 'utf8')).version

console.log(`Shell Memory · QVAC SDK ${version} · everything runs on this device\n`)
console.log(`Question: ${question}\n`)

try {
  // Stage 1: embedding model only, so RAM stays low.
  const embedId = await loadModel({ modelSrc: EMBEDDINGGEMMA_300M_Q4_0 })
  const hits = await ragSearch({ modelId: embedId, workspace: WORKSPACE, query: question, topK: 3 })
  await ragCloseWorkspace({ workspace: WORKSPACE })
  await unloadModel({ modelId: embedId })

  if (hits.length === 0) {
    console.log('No matches found.')
    process.exit(0)
  }

  console.log('Best matches from your history:')
  hits.forEach((h, i) => {
    const meta = index[h.content.trim()] ?? {}
    const when = meta.ts ? new Date(meta.ts * 1000).toISOString().slice(0, 10) : 'no date'
    console.log(`  ${i + 1}. ${h.content}`)
    console.log(`     score ${Number(h.score).toFixed(2)} · line ${meta.line ?? '?'} · ${when} · used ${meta.count ?? 1}x`)
  })

  // Stage 2: LLM explains the matches.
  const llmId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelConfig: { device: 'cpu', ctx_size: 2048 }
  })
  const run = completion({
    modelId: llmId,
    history: [
      {
        role: 'system',
        content:
          'You explain shell commands in plain English. Reply with exactly one short sentence saying what the command does. ' +
          'Never write, repeat or modify a command. ' +
          'Never mention paths or file names that are not in the command.'
      },
      { role: 'user', content: `What does this command do? ${hits[0].content}` }
    ],
    stream: true,
    generationParams: { temp: 0, predict: 120 }
  })

  console.log(`\nBest command: ${hits[0].content}`)
  console.log('\nExplanation:')
  for await (const event of run.events) {
    if (event.type === 'contentDelta') process.stdout.write(event.text)
  }
  console.log()
  await unloadModel({ modelId: llmId })
  process.exit(0)
} catch (error) {
  console.error('✖', error)
  process.exit(1)
}
