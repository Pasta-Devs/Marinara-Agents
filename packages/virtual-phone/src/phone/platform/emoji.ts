/**
 * There is no real image generation yet (Engine Step 11.3). Until there is, anywhere the phone
 * would show a photo shows a greyed emoji guessed from the text instead — a placeholder that reads
 * as designed, not broken. One source so every app picks the same emoji for the same thing.
 * Pure (no React) so server/manifest code can share it without pulling in the renderer.
 */
const EMOJI: Array<[RegExp, string]> = [
  [/\b(coat|jacket|dress|boots?|shoes?|shirt|clothes|hat|scarf)\b/iu, "🧥"],
  [/\b(book|novel|letter|diary|journal|map|paper)\b/iu, "📖"],
  [/\b(record|vinyl|music|guitar|song|album)\b/iu, "🎸"],
  [/\b(sword|knife|blade|gun|pistol|rifle|armou?r|shield|weapon)\b/iu, "🗡️"],
  [/\b(dog|cat|horse|bird|fish|pet|animal)\b/iu, "🐾"],
  [/\b(phone|laptop|computer|camera|radio|device|electronic)\b/iu, "📱"],
  [/\b(ring|necklace|jewel|gold|silver|watch|gem)\b/iu, "💍"],
  [/\b(food|bread|wine|drink|coffee|meal|fruit|cake)\b/iu, "🍞"],
  [/\b(car|bike|bicycle|boat|cart|vehicle|wheel)\b/iu, "🚲"],
  [/\b(plant|flower|herb|seed|garden|tree)\b/iu, "🌿"],
  [/\b(key|lock|tool|hammer|wrench|parts?)\b/iu, "🔧"],
  [/\b(bar|pub|tavern|inn|club|restaurant|cafe|café)\b/iu, "🍺"],
  [/\b(shop|store|market|stall)\b/iu, "🏪"],
  [/\b(home|house|apartment|flat|cottage)\b/iu, "🏠"],
  [/\b(harbou?r|dock|pier|port|sea|beach|water)\b/iu, "⚓"],
  [/\b(park|forest|wood|hill|mountain|field)\b/iu, "🌲"],
  [/\b(church|temple|cathedral|shrine)\b/iu, "⛪"],
  [/\b(station|airport|train|bus|stop)\b/iu, "🚉"],
  [/\b(hospital|clinic|doctor|pharmacy)\b/iu, "🏥"],
  [/\b(school|library|university|college)\b/iu, "🏫"],
];

export function emojiFor(text: string, fallback = "🖼️") {
  for (const [pattern, emoji] of EMOJI) if (pattern.test(text)) return emoji;
  return fallback;
}
