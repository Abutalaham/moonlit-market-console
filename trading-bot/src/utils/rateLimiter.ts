export class RateLimiter {
  private readonly timestamps: number[] = [];

  constructor(private readonly limit: number, private readonly windowMs = 60_000) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Rate limit must be a positive integer");
    if (!Number.isFinite(windowMs) || windowMs < 1) throw new Error("Rate-limit window must be positive");
  }

  async waitForSlot(now = Date.now()): Promise<void> {
    while (true) {
      while (this.timestamps.length && now - this.timestamps[0]! >= this.windowMs)
        this.timestamps.shift();
      if (this.timestamps.length < this.limit) {
        this.timestamps.push(now);
        return;
      }
      const delay = Math.max(1, this.timestamps[0]! + this.windowMs - now);
      await new Promise((resolve) => setTimeout(resolve, delay));
      now = Date.now();
    }
  }
}
