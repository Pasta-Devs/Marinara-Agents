// Canonical English for fixed, persisted combat voices and their explicit recovery action.
export const forgeCombatVoiceEnglish = {
  "combat.voices.failed": "Some combat voice lines could not be prepared. The battle can continue silently.",
  "combat.voices.retry": "Retry combat voices",
  "combat.voices.retryTitle": "Retry combat voice generation?",
  "combat.voices.retryWarning":
    "Only missing or failed clips will be generated. An interrupted provider request may still have used credits; retrying can use model and voice provider credits again. Saved clips will be reused.",
  "combat.voices.cancel": "Keep silent",
};

export const forgeCombatVoiceStyles = `
.gf-combat-voice-status { position: absolute; z-index: 16; right: var(--sp-2); bottom: var(--sp-2);
  display: flex; align-items: center; gap: .5rem; max-width: min(34rem,calc(100% - 2 * var(--sp-2)));
  box-sizing: border-box; padding: .4rem .6rem; color: var(--text); background: var(--ink-2);
  border: 1px solid var(--steel-dark); border-radius: var(--radius-sm); font: var(--t-xs)/1.3 var(--body); }
.gf-combat-voice-status[hidden] { display: none; }
.gf-combat-voice-status span { min-width: 0; }
.gf-combat-voice-status button { flex: none; min-height: 44px; padding: .3rem .6rem;
  color: var(--text); background: var(--ink); border: 1px solid var(--steel); border-radius: var(--radius-sm);
  font: inherit; cursor: pointer; }
.gf-combat-voice-status button:focus-visible { outline: 2px solid var(--coral); outline-offset: 2px; }
@media (max-height: 500px) { .gf-combat-voice-status span { display: none; } }
`;
