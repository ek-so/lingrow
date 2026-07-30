import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Check, CircleHelp, Headphones, RotateCcw } from "lucide-react"

export type StudyRating = "known" | "learning" | "listened"

interface StudyStatsProps {
  collectionName: string
  total: number
  known: number
  learning: number
  listened: number
  onFinish: () => void
  onRestart: () => void
}

export function StudyStats({
  collectionName,
  total,
  known,
  learning,
  listened,
  onFinish,
  onRestart,
}: StudyStatsProps) {
  const rated = known + learning + listened
  const headline =
    listened === total && known === 0 && learning === 0
      ? "Session complete"
      : known === total
        ? "Nailed it"
        : "Nice work"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-10">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Results</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{headline}</h1>
        <p className="mt-1 text-muted-foreground">{collectionName}</p>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">You know</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">
            {known}
            <span className="text-xl font-medium text-muted-foreground"> / {total}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {rated < total ? `${total - rated} not rated yet · ` : null}
            {Math.round((known / Math.max(total, 1)) * 100)}% known
          </p>

          <div className="mt-6 grid gap-3">
            <StatRow
              icon={<Check className="h-4 w-4 text-primary" />}
              label="Know"
              hint="Swiped right"
              value={known}
            />
            <StatRow
              icon={<CircleHelp className="h-4 w-4 text-destructive" />}
              label="Still learning"
              hint="Swiped left"
              value={learning}
            />
            <StatRow
              icon={<Headphones className="h-4 w-4 text-muted-foreground" />}
              label="Listened"
              hint="Played in auto mode"
              value={listened}
            />
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-10">
          <Button size="lg" onClick={onFinish}>
            Finish
          </Button>
          <Button size="lg" variant="outline" onClick={onRestart}>
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatRow({
  icon,
  label,
  hint,
  value,
}: {
  icon: ReactNode
  label: string
  hint: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-card">{icon}</span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}
