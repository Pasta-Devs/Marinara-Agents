export function getSkillCheckOutcomeLabel(result) {
    if (result.criticalSuccess)
        return "Critical success";
    if (result.criticalFailure)
        return "Critical failure";
    return result.success ? "Success" : "Failure";
}
export function getSkillCheckOutcomeKey(result) {
    if (result.criticalSuccess)
        return "critical_success";
    if (result.criticalFailure)
        return "critical_failure";
    return result.success ? "success" : "failure";
}
export function formatSkillCheckResultSummary(result) {
    const modifier = result.modifier === 0 ? "" : ` ${result.modifier > 0 ? "+" : ""}${result.modifier}`;
    const rollMode = result.rollMode !== "normal" ? ` (${result.rollMode})` : "";
    return `${result.skill} check (DC ${result.dc}): [${result.rolls.join(", ")}]${modifier}${rollMode} = ${result.total}. ${getSkillCheckOutcomeLabel(result)}.`;
}
function serializeSkillCheckAttribute(value) {
    return value.replace(/["\r\n]/g, "'").trim();
}
export function serializeResolvedSkillCheckTag(result) {
    return [
        `[skill_check: skill="${serializeSkillCheckAttribute(result.skill)}"`,
        `dc="${result.dc}"`,
        `rolls="${result.rolls.join("|")}"`,
        `used="${result.usedRoll}"`,
        `modifier="${result.modifier}"`,
        `total="${result.total}"`,
        `result="${getSkillCheckOutcomeKey(result)}"`,
        `mode="${result.rollMode}"]`,
    ].join(" ");
}
//# sourceMappingURL=skill-check-format.js.map