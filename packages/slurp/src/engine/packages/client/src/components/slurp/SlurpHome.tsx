import { UserRound, UsersRound } from "lucide-react";
import { useSlurpPackageStore } from "../../stores/slurp-package.store";
import type { SlurpSourceKind } from "./slurp-navigation.types";

function SourceChoice({ kind, onChoose }: { kind: SlurpSourceKind; onChoose: () => void }) {
  const character = kind === "character";
  return (
    <button
      type="button"
      onClick={onChoose}
      className="flex min-h-28 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--accent)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/15 text-[var(--primary)]">
        {character ? <UsersRound size="1.25rem" /> : <UserRound size="1.25rem" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--foreground)]">
          {character ? "Choose a character" : "Choose a persona"}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-[var(--muted-foreground)]">
          Create one independent Slurp Creator profile from an Engine {character ? "character" : "persona"}.
        </span>
      </span>
    </button>
  );
}

export function SlurpHome() {
  const navigation = useSlurpPackageStore((state) => state.navigation);
  const setNavigation = useSlurpPackageStore((state) => state.setNavigation);
  const selectedSource = useSlurpPackageStore((state) => state.selectedSource);
  const viewerPersonaId = useSlurpPackageStore((state) => state.viewerPersonaId);

  if (navigation.view === "preview") {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
        <header className="border-b border-[var(--border)] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">Slurp</p>
          <h1 className="mt-1 text-xl font-semibold">Owner preview</h1>
        </header>
        <section className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-10">
          <div className="w-full rounded-xl border border-dashed border-[var(--border)] p-6">
            <p className="text-sm font-semibold">No Engine persona is available.</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              This preview is read-only. It cannot like, reply, follow, subscribe, unlock, or change feed state.
            </p>
            <button
              type="button"
              onClick={() => setNavigation({ view: "home" })}
              className="mt-5 min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--accent)]"
            >
              Back to Slurp
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">Slurp</p>
        <h1 className="mt-1 text-xl font-semibold">Creator feed</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          Build a local Creator world from your Engine characters and personas.
        </p>
      </header>
      <section className="mx-auto w-full max-w-3xl space-y-5 px-5 py-8">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-base font-semibold">Start with a fresh Slurp profile</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Slurp starts empty. Select one Engine source to create one independent Creator profile.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SourceChoice kind="character" onChoose={() => setNavigation({ view: "sources" })} />
            <SourceChoice kind="persona" onChoose={() => setNavigation({ view: "sources" })} />
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted-foreground)]">
          <p className="font-semibold text-[var(--foreground)]">Viewer access</p>
          <p className="mt-2 leading-relaxed">
            Slurp uses Engine personas for viewer-specific follows, subscriptions, unlocks, and feed state.
          </p>
          {!viewerPersonaId ? (
            <button
              type="button"
              onClick={() => setNavigation({ view: "preview" })}
              className="mt-4 min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent)]"
            >
              Open owner preview
            </button>
          ) : null}
        </div>
        {selectedSource ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Selected source: {selectedSource.kind} / {selectedSource.entityId}
          </p>
        ) : null}
      </section>
    </main>
  );
}
