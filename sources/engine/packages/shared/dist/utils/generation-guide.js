export function buildNarratorInstructionMessage(direction) {
    return `[Narrator instruction — do not include a reply from {{user}}. Instead, write the next part of the narrative steering it toward the following: ${direction.trim()}]`;
}
export function buildGuidedGenerationInstructionMessage(direction) {
    return `[Guided generation instruction — do not include a reply from {{user}}. Instead, write the next generated message steering it toward the following: ${direction.trim()}]`;
}
export function stripGenerationGuideInstruction(value) {
    const match = value.match(/^\[(?:Narrator|Guided generation) instruction [^\]]*? following:\s*([\s\S]*)\]$/);
    return match?.[1]?.trim() || value;
}
//# sourceMappingURL=generation-guide.js.map