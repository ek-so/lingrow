/**
 * Builds a single continuous MP3 per collection so iOS can keep playing
 * with the screen locked (speechSynthesis stops in the background).
 *
 * Timing mirrors Study.tsx gaps: 400ms after DE, 600ms after EN, 900ms between words.
 */
import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const collectionsPath = path.join(root, "src/data/collections.json")
const outRoot = path.join(root, "public/audio")

const GAP_AFTER_DE_SEC = 0.4
const GAP_AFTER_EN_SEC = 0.6
const GAP_BETWEEN_WORDS_SEC = 0.9
const SAMPLE_RATE = 24000
const BITRATE = "64k"

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchTts(text, lang, dest) {
  const url = new URL("https://translate.googleapis.com/translate_tts")
  url.searchParams.set("ie", "UTF-8")
  url.searchParams.set("client", "gtx")
  url.searchParams.set("tl", lang)
  url.searchParams.set("q", text)

  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "audio/mpeg,*/*",
        Referer: "https://translate.google.com/",
      },
    })
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 200) {
        throw new Error(`TTS response too small for "${text}" (${lang})`)
      }
      await writeFile(dest, buf)
      return
    }
    if (attempt === 4) {
      throw new Error(`TTS failed for "${text}" (${lang}): HTTP ${res.status}`)
    }
    await sleep(400 * attempt)
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(" ")} failed (${code}): ${stderr}`))
    })
  })
}

async function probeDuration(file) {
  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (c) => {
      stdout += c.toString()
    })
    child.stderr.on("data", (c) => {
      stderr += c.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr}`))
        return
      }
      const n = Number.parseFloat(stdout.trim())
      if (!Number.isFinite(n)) reject(new Error(`Bad duration for ${file}: ${stdout}`))
      else resolve(n)
    })
  })
}

async function makeSilence(dest, seconds) {
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
    "-t",
    String(seconds),
    "-c:a",
    "libmp3lame",
    "-b:a",
    BITRATE,
    dest,
  ])
}

async function concatMp3(files, dest) {
  const listFile = `${dest}.txt`
  const body = files.map((f) => `file '${f.replaceAll("'", "'\\''")}'`).join("\n")
  await writeFile(listFile, body)
  try {
    await run("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      dest,
    ])
  } finally {
    await rm(listFile, { force: true })
  }
}

async function buildCollection(collection) {
  const workDir = path.join(outRoot, ".tmp", collection.id)
  const outDir = path.join(outRoot, collection.id)
  await rm(workDir, { recursive: true, force: true })
  await mkdir(workDir, { recursive: true })
  await mkdir(outDir, { recursive: true })

  const silenceDe = path.join(workDir, "gap-de.mp3")
  const silenceEn = path.join(workDir, "gap-en.mp3")
  const silenceWord = path.join(workDir, "gap-word.mp3")
  await makeSilence(silenceDe, GAP_AFTER_DE_SEC)
  await makeSilence(silenceEn, GAP_AFTER_EN_SEC)
  await makeSilence(silenceWord, GAP_BETWEEN_WORDS_SEC)

  const parts = []
  const segments = []
  let cursor = 0

  for (let i = 0; i < collection.words.length; i++) {
    const word = collection.words[i]
    const dePath = path.join(workDir, `${i}-de.mp3`)
    const enPath = path.join(workDir, `${i}-en.mp3`)

    await fetchTts(word.de, "de", dePath)
    await sleep(120)
    await fetchTts(word.en, "en", enPath)
    await sleep(120)

    const deDur = await probeDuration(dePath)
    segments.push({
      wordIndex: i,
      phase: "de",
      start: Number(cursor.toFixed(3)),
      end: Number((cursor + deDur).toFixed(3)),
    })
    parts.push(dePath)
    cursor += deDur

    parts.push(silenceDe)
    cursor += GAP_AFTER_DE_SEC

    const enDur = await probeDuration(enPath)
    segments.push({
      wordIndex: i,
      phase: "en",
      start: Number(cursor.toFixed(3)),
      end: Number((cursor + enDur).toFixed(3)),
    })
    parts.push(enPath)
    cursor += enDur

    parts.push(silenceEn)
    cursor += GAP_AFTER_EN_SEC

    if (i < collection.words.length - 1) {
      segments.push({
        wordIndex: i,
        phase: "pause",
        start: Number(cursor.toFixed(3)),
        end: Number((cursor + GAP_BETWEEN_WORDS_SEC).toFixed(3)),
      })
      parts.push(silenceWord)
      cursor += GAP_BETWEEN_WORDS_SEC
    } else {
      segments.push({
        wordIndex: i,
        phase: "pause",
        start: Number(cursor.toFixed(3)),
        end: Number(cursor.toFixed(3)),
      })
    }
  }

  const sessionPath = path.join(outDir, "session.mp3")
  await concatMp3(parts, sessionPath)
  const duration = await probeDuration(sessionPath)

  const manifest = {
    collectionId: collection.id,
    audio: `audio/${collection.id}/session.mp3`,
    duration: Number(duration.toFixed(3)),
    segments,
  }
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
  await rm(workDir, { recursive: true, force: true })
  console.log(`✓ ${collection.id}: ${collection.words.length} words, ${duration.toFixed(1)}s`)
  return manifest
}

async function main() {
  const collections = JSON.parse(await readFile(collectionsPath, "utf8"))
  await mkdir(outRoot, { recursive: true })
  const index = {}
  for (const collection of collections) {
    index[collection.id] = await buildCollection(collection)
  }
  await writeFile(path.join(outRoot, "index.json"), JSON.stringify(index, null, 2) + "\n")
  console.log(`Generated audio for ${collections.length} collection(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
