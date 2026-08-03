import { DependencyRow } from "@/components/onboarding/dependency-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { Dependency } from "@/types/agent";

const stayOpen = (event: Event | KeyboardEvent) => event.preventDefault();

export function WelcomeDialog({
  dependencies,
  ratio,
  settled,
  error,
  onRetry,
  onStart,
}: {
  dependencies: Dependency[];
  ratio: number;
  settled: boolean;
  error: string;
  onRetry: () => void;
  onStart: () => void;
}) {
  const percent = Math.round(ratio * 100);

  const label = error
    ? "Installation stopped"
    : settled
      ? "Dependencies ready"
      : "Installing dependencies…";

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-6 p-8 outline-none sm:max-w-lg"
        onEscapeKeyDown={stayOpen}
        onPointerDownOutside={stayOpen}
        onInteractOutside={stayOpen}
      >
        <DialogHeader className="gap-2">
          <span className="micro-label">Welcome</span>
          <DialogTitle className="text-xl">Install Dependencies</DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border rounded-lg ring-1 ring-border">
          {dependencies.map((dependency) => (
            <DependencyRow key={dependency.id} dependency={dependency} />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {percent}%
            </span>
          </div>

          <Progress
            aria-label={label}
            value={percent}
            indicatorClassName={error ? "bg-state-failed" : undefined}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {(settled || error) && (
          <DialogFooter>
            {error ? (
              <Button autoFocus className="min-w-36" onClick={onRetry}>
                Try again
              </Button>
            ) : (
              <Button autoFocus className="min-w-36" onClick={onStart}>
                Start building
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
