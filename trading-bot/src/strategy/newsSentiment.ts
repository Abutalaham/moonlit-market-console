const POSITIVE = [
  "PROFIT", "SURGE", "GROWTH", "RECORD", "BEAT", "EXPANSION", "DIVIDEND", "PARTNERSHIP",
];
const NEGATIVE = [
  "LOSS", "PLUNGE", "DROP", "FRAUD", "SCRUTINY", "RESIGNATION", "PROBE", "DOWNGRADE",
];

export type Sentiment = "positive" | "negative" | "neutral";

export class NewsSentiment {
  private readonly eventKeys = new Set<string>();
  private readonly recent: { key: string; score: number }[] = [];

  constructor(private readonly maxEvents = 100) {
    if (!Number.isInteger(maxEvents) || maxEvents < 1) throw new Error("maxEvents must be a positive integer");
  }

  add(ticker: string, headline: string, description: string, simulatedDate: string): boolean {
    const normalized = `${ticker}|${simulatedDate}|${headline}|${description}`
      .normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
    const key = normalized;
    if (this.eventKeys.has(key)) return false;
    this.eventKeys.add(key);
    this.recent.push({ key, score: this.score(`${headline} ${description}`) });
    while (this.recent.length > this.maxEvents) {
      const removed = this.recent.shift();
      if (removed) this.eventKeys.delete(removed.key);
    }
    return true;
  }

  getSentiment(ticker: string): { score: number; sentiment: Sentiment } {
    const score = this.recent
      .filter(({ key }) => key.startsWith(`${ticker}|`))
      .reduce((sum, item) => sum + item.score, 0);
    return {
      score,
      sentiment: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
    };
  }

  private score(text: string): number {
    const upper = text.normalize("NFKC").toUpperCase();
    const count = (word: string) => upper.match(new RegExp(`\\b${word}\\b`, "g"))?.length ?? 0;
    return POSITIVE.reduce((sum, word) => sum + count(word), 0)
      - NEGATIVE.reduce((sum, word) => sum + count(word), 0);
  }
}
