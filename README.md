# shell-memory

Ask your own terminal history questions in plain language, fully on-device.
No cloud AI, no API keys, and your commands never leave the machine.

## What it does
`ingest.js` reads a shell history file, drops boring or credential-looking lines, embeds every
unique command and stores the vectors locally. `ask.js` embeds your question, finds the closest
commands, and a small local LLM explains the best match. Each match shows its history line number.

QVAC functions used: `loadModel`, `ragIngest`, `ragSearch`, `completion`, `unloadModel`.

## Requirements
- Node.js 22.17 or newer
- QVAC SDK 0.20.0 (`@qvac/sdk`)
- CPU is enough. Tested on a 3.7 GB RAM laptop with no GPU.

## Install
    npm install

## Run
    node ingest.js                  # indexes ./demo_history.txt
    node ingest.js ~/.bash_history  # or your own history
    node ask.js "how did I kill the process on port 3000?"

The first run downloads the embedding model and Llama 3.2 1B once. After that it works offline.
The index is stored in `memory-index.json` (not committed), so run `ingest.js` before `ask.js`.

## Sample output
    Question: port 3000 wala process kill karne ka command kaunsa tha

    Best matches from your history:
      1. lsof -ti:3000 | xargs kill -9
         score 0.56 · line 16 · no date · used 1x

## Limitations
- Retrieval is the main feature. The 1B model's explanation can be imprecise, so trust the matched command first.
- Commands that look like they contain tokens or passwords are skipped on purpose.
- `demo_history.txt` is dummy data.
