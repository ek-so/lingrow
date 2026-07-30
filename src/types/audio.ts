export type StudyPhase = "de" | "en" | "pause"

export interface StudySegment {
  wordIndex: number
  phase: StudyPhase
  /** Start time in seconds within the session audio. */
  start: number
  /** End time in seconds within the session audio. */
  end: number
}

export interface StudyAudioManifest {
  collectionId: string
  audio: string
  duration: number
  segments: StudySegment[]
}
