/** Drama pack fixtures shared by the drama regressions: a drama with no player, and a situation with one. */
export const rivals = {
  id: "test-rivals",
  name: "Rivals",
  roles: [{ key: "a" }, { key: "b", needs: { sharesNicheWith: "a" } }],
  maxDays: 14,
  stages: [
    {
      key: "spark",
      days: [1, 2],
      beats: [{ role: "b", channel: "comment", on: "a", lines: ["cute. anyway"] }],
    },
    {
      key: "one-up",
      days: [2, 4],
      choice: {
        asks: "fans",
        question: "Who wore it better?",
        options: [
          { label: "a", next: "end" },
          { label: "b", next: "end" },
        ],
        default: 0,
      },
      beats: [{ role: "a", channel: "post", heat: { line: "saw what someone posted. anyway", for: "fans" } }],
      outcomes: [{ kind: "tie", tie: "rival", between: ["a", "b"] }],
    },
  ],
  exit: { role: "a", channel: "post", heat: { line: "truce. for now." } },
};
export const partner = {
  id: "test-partner",
  name: "Partner is a Creator",
  roles: [
    { key: "her", needs: { relationToPlayer: ["partner"] } },
    { key: "you", player: true },
  ],
  dials: [{ key: "audience-knows", options: ["yes", "no"], default: "yes" }],
  deck: [
    { role: "her", channel: "dm", to: "you", seed: "a fan tipped big for the last set" },
    { role: "crowd", channel: "comment", on: "her", lines: ["lucky man"], when: { "audience-knows": "yes" } },
  ],
};
