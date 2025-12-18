import { describe, expect, it } from "vitest";
import { chunkText } from "../src/lib/chunking.js";

describe("chunkText", () => {
  it("returns empty array for whitespace-only input", async () => {
    expect(await chunkText("   \n\t  ", "recursive", 100, 20)).toEqual([]);
    expect(await chunkText("   \n\t  ", "fixed", 100, 20)).toEqual([]);
  });

  it("handles multiline text and overlap in fixed mode", async () => {
    const text = "line1\nline2\nline3\nline4";
    const chunks = await chunkText(text, "fixed", 10, 3);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toBe("line1\nline");
    expect(chunks[1].startsWith("ine2")).toBe(true);
  });

  it("splits long text with recursive strategy", async () => {
    const text = Array.from({ length: 20 }, (_, i) => `Sentence ${i}.`).join(
      " "
    );
    const chunks = await chunkText(text, "recursive", 60, 10);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(60);
    }
  });

  it("rejects invalid chunkSize or chunkOverlap", async () => {
    await expect(chunkText("hello", "fixed", 0, 0)).rejects.toThrow();
    await expect(chunkText("hello", "fixed", 100, 100)).rejects.toThrow();
    await expect(chunkText("hello", "fixed", 100, -1)).rejects.toThrow();
  });
});
