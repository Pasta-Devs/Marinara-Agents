// ──────────────────────────────────────────────
// Otome Hearth: the personality quiz's starting statements (#2174)
// ──────────────────────────────────────────────
// 100 statements written for this package, after the themes of online kink, relationship and personality tests (never
// their wording). Each has a stable id (its category's letter and number: a stored answer or score is keyed by it, so
// an id is never reused or renumbered), a category, and `adult` for the ones about sex and kinks, which a story shows,
// scores and writes only while its Heat is NSFW. They are asked interleaved, one category after another, so the first
// few already cover a little of everything. A statement is phrased so 1 (strongly disagree) to 5 (strongly agree)
// reads naturally.

export type QuizCategory = "intimacy" | "love" | "together" | "temperament";

export interface QuizStarter {
  id: string;
  text: string;
  category: QuizCategory;
  adult: boolean;
}

const INTIMACY = [
  "Vanilla sex is all I need to feel satisfied.",
  "I like to be in control in bed.",
  "I like giving up control to a partner I trust.",
  "I enjoy switching between leading and following in bed.",
  "Being tied up sounds exciting to me.",
  "I'd enjoy tying a partner up.",
  "A little pain can make pleasure better.",
  "I like hearing praise when I'm being intimate.",
  "Being called degrading names in bed turns me on.",
  "I'd enjoy acting out a roleplay scenario with a partner.",
  "The thought of being watched during sex excites me.",
  "I'd enjoy watching others be intimate.",
  "Aftercare matters to me as much as the sex itself.",
  "I want to talk through limits and a safeword before trying anything new.",
  "I like rough sex more than gentle sex.",
  "Slow, lingering foreplay is my favourite part.",
  "Teasing and being made to wait drives me wild.",
  "I'd like to be told what to do in bed.",
  "I enjoy leaving marks, or wearing them.",
  "Dirty talk is a big part of good sex for me.",
  "I'd have sex somewhere we might get caught.",
  "Toys belong in the bedroom.",
  "Morning sex is the best kind.",
  "Pleasing my partner matters more to me than my own pleasure.",
  "Biting, scratching and hair-pulling are welcome in bed.",
  "I like sex best when one of us clearly holds the power.",
  "Blindfolds, ice or wax: sensory play appeals to me.",
  "I'd enjoy being someone's pet in the bedroom.",
  "Being pushed past one more orgasm sounds more fun than frightening.",
  "I'd let a partner decide what I wear, or don't, for a night.",
  "Sex is better with deep emotional intimacy than without it.",
  "A one-night stand can be as good as sex with someone I love.",
];

const LOVE = [
  'Hearing "I love you" means more to me than any gift.',
  "I feel most loved when my partner gives me their undivided time.",
  "A thoughtful gift, even a small one, makes my day.",
  "Casual touch, like a hand on my back, matters a lot to me.",
  "When someone takes a chore off my hands, I feel cared for.",
  "I'd rather show love than say it.",
  "I remember the little things my partner tells me.",
  "Grand romantic gestures win me over.",
  "I like public displays of affection.",
  "I need regular reassurance that I'm loved.",
  "I fall in love quickly.",
  "I believe in love at first sight.",
  "I'd rather have one great love than several good ones.",
  "Writing love letters is a beautiful thing to do.",
  "Cooking for someone is one of my favourite ways to care for them.",
  "I like being spoiled.",
  "I'd rather plan a date than improvise one.",
  "A quiet night in beats a fancy night out.",
  "A little jealousy is romantic.",
  "I want my partner to be my best friend.",
];

const TOGETHER = [
  "I need time alone even when I'm in a relationship.",
  "I'd rather argue it out right away than sleep on it.",
  "I find it easy to apologize first.",
  "Honesty matters more to me than keeping the peace.",
  "I hold grudges longer than I'd like to admit.",
  "I'd forgive a betrayal if the person truly changed.",
  "My partner's friends should become my friends.",
  "Keeping some secrets in a relationship is healthy.",
  "I'd move across the world for the person I love.",
  "Partners should share everything, down to their passwords.",
  "I go quiet when I'm hurt instead of saying so.",
  "I want a partner who challenges me.",
  "Stability matters more to me than passion.",
  "I'd rather be the one who protects than the one who is protected.",
  "I'm comfortable showing my partner my weaknesses.",
  "A promise should be kept even when it costs you.",
  "I'd tell my partner a hard truth even if it hurt them.",
  "I want to build a life together, not just spend time together.",
  "Teasing is one of my favourite ways to flirt.",
  "I'd stay with someone through their worst years.",
];

const TEMPERAMENT = [
  "I recharge by being around people.",
  "I'd rather plan my week than see where it goes.",
  "I trust my head more than my heart.",
  "I'm comfortable being the centre of attention.",
  "I keep my feelings to myself until I'm sure of them.",
  "Rules are there to be bent.",
  "I notice details others miss.",
  "I make decisions quickly and rarely regret them.",
  "I'd rather lead than follow.",
  "I get restless when nothing is happening.",
  "I care a lot about what others think of me.",
  "I'm more of a dreamer than a doer.",
  "I find it easy to read people's moods.",
  "Tradition matters to me.",
  "I like taking risks.",
  "I'm slow to trust new people.",
  "I keep my space tidy and organized.",
  "Winning matters to me.",
  "I'd rather have a few close friends than many acquaintances.",
  "I laugh easily, even at myself.",
  "I stay calm in a crisis.",
  "I'd rather know the truth than be comfortable.",
  "I enjoy debating just for the fun of it.",
  "I'm a night owl.",
  "I'd give up comfort for adventure.",
  "I often put others' needs before my own.",
  "I'm too proud to ask for help.",
  "Ambition drives most of what I do.",
];

const GROUPS: ReadonlyArray<{ category: QuizCategory; letter: string; texts: readonly string[] }> = [
  { category: "temperament", letter: "p", texts: TEMPERAMENT },
  { category: "love", letter: "l", texts: LOVE },
  { category: "intimacy", letter: "i", texts: INTIMACY },
  { category: "together", letter: "t", texts: TOGETHER },
];

/** Every starting statement, interleaved by category (see the header). */
export const QUIZ_STARTERS: readonly QuizStarter[] = (() => {
  const lists = GROUPS.map(({ category, letter, texts }) =>
    texts.map((text, index) => ({
      id: `${letter}${String(index + 1).padStart(2, "0")}`,
      text,
      category,
      adult: category === "intimacy",
    })),
  );
  const longest = Math.max(...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, index) => lists.flatMap((list) => list[index] ?? [])).flat();
})();
