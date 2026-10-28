/**
 * The one focus ring for Slurp's own controls. Slice 9 left this string copied into four files;
 * they were byte-identical, so a change to the focus treatment had to be made four times.
 *
 * The `quietButton` composites built on top of it are deliberately NOT shared: the Creators,
 * Maintenance and Settings variants differ in minimum height and in whether they animate, so
 * merging them would change what renders. Each builds its own string from this ring.
 */
export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]";
