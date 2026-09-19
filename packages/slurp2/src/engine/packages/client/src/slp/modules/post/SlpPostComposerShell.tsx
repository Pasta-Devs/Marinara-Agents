// Shared composer chrome: avatar gutter, borderless body, divider, and the
// tools-left / action-right toolbar row. Noodle fills it with its post composer;
// NoodleR fills it with the guided-generation composer. Keeps both pixel-aligned.
export function NoodleComposerShell({
  header,
  avatar,
  children,
  tools,
  action,
  popovers,
  footer,
  dataComponent,
}: {
  header?: React.ReactNode;
  avatar: React.ReactNode;
  children: React.ReactNode;
  tools?: React.ReactNode;
  action: React.ReactNode;
  popovers?: React.ReactNode;
  footer?: React.ReactNode;
  dataComponent?: string;
}) {
  return (
    <div className="border-b border-[var(--noodle-divider)] px-4 py-3" data-component={dataComponent}>
      {header && <div className="mb-2">{header}</div>}
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
        {avatar}
        <div className="min-w-0">{children}</div>
      </div>
      <div className="mt-1 h-px w-full bg-[var(--noodle-divider)]" />
      {/* Tools and actions are two wrapping groups, not seven buttons in one row: on a
          phone the old single row broke them apart mid-group. The avatar-width indent
          is a wide-layout nicety and costs 3.5rem the narrow layout cannot spare. */}
      <div className="relative mt-3 flex flex-wrap items-center gap-2 @min-[480px]:pl-14">
        <div className="flex min-w-0 flex-wrap items-center gap-1">{tools}</div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{action}</div>
        {popovers}
      </div>
      {footer}
    </div>
  );
}
