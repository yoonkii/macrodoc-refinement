// ---------------------------------------------------------------------------
// Root template — wraps every page and remounts on each top-level navigation
// (see node_modules/next/dist/docs/.../file-conventions/template.md). That
// remount hands the wrapper a fresh DOM node, so the pure-CSS `.page-enter`
// animation replays on / → /settings → /voice → /playground navigations.
//
// Why a template (not the experimental View Transitions API): Next 16.2.3
// documents `experimental.viewTransition` as `version: experimental`, so per
// project guidance we use the stable template.tsx fallback. Enter-only, CSS
// only, transform+opacity (no layout shift), and disabled under
// prefers-reduced-motion via the rule in globals.css.
// ---------------------------------------------------------------------------

export default function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter">{children}</div>;
}
