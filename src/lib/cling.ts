/** Short pleasant “cling” chime via Web Audio (no asset file). */
export function playClingSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const tones = [
      { freq: 1046.5, start: 0, gain: 0.12 },
      { freq: 1568.0, start: 0.05, gain: 0.1 },
      { freq: 2093.0, start: 0.1, gain: 0.07 },
    ]

    for (const tone of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = tone.freq
      const t0 = now + tone.start
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(tone.gain, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.5)
    }

    window.setTimeout(() => {
      void ctx.close()
    }, 800)
  } catch {
    // Audio unavailable — ignore.
  }
}
