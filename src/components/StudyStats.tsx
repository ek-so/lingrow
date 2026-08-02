import type { ReactNode } from "react"
import { AppShell } from "@/components/AppShell"
import { Button } from "@/components/ui/button"
import { Check, CircleHelp, Headphones, RotateCcw, SkipForward } from "lucide-react"

export type StudyRating = "known" | "learning" | "listened" | "skipped"

interface StudyStatsProps {
  collectionName: string
  total: number
  known: number
  learning: number
  listened: number
  skipped: number
  onFinish: () => void
  onRestart: () => void
}

export function StudyStats({
  collectionName,
  total,
  known,
  learning,
  listened,
  skipped,
  onFinish,
  onRestart,
}: StudyStatsProps) {
  const headline =
    listened === total && known === 0 && learning === 0 && skipped === 0
      ? "Session complete"
      : known === total
        ? "Nailed it"
        : "Nice work"

  const rows = [
    {
      key: "known",
      icon: <Check className="h-4 w-4 text-primary" />,
      label: "Know",
      hint: "Swiped right",
      value: known,
    },
    {
      key: "learning",
      icon: <CircleHelp className="h-4 w-4 text-destructive" />,
      label: "Still learning",
      hint: "Swiped left",
      value: learning,
    },
    {
      key: "listened",
      icon: <Headphones className="h-4 w-4 text-muted-foreground" />,
      label: "Listened",
      hint: "Played in auto mode",
      value: listened,
    },
    {
      key: "skipped",
      icon: <SkipForward className="h-4 w-4 text-muted-foreground" />,
      label: "Skipped",
      hint: "Passed with next",
      value: skipped,
    },
  ].filter((row) => row.value > 0)

  return (
    <AppShell
      scroll={false}
      footer={
        <div className="border-t border-border/80 bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl flex-col gap-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button size="lg" onClick={onFinish}>
              Finish
            </Button>
            <Button size="lg" variant="outline" onClick={onRestart}>
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex h-full items-center justify-center overflow-hidden px-5">
        <div className="w-full max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Results</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{headline}</h1>
          <p className="mt-1 text-muted-foreground">{collectionName}</p>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">You know</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">
              {known}
              <span className="text-xl font-medium text-muted-foreground"> / {total}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {Math.round((known / Math.max(total, 1)) * 100)}% known
            </p>

            {rows.length > 0 ? (
              <div className="mt-6 grid gap-3">
                {rows.map((row) => (
                  <StatRow
                    key={row.key}
                    icon={row.icon}
                    label={row.label}
                    hint={row.hint}
                    value={row.value}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
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
