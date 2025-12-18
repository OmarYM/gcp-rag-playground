import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export type ChunkingStrategy = "recursive" | "fixed";

export async function chunkText(
  text: string,
  strategy: ChunkingStrategy = "recursive",
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<string[]> {
  if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
    throw new Error("chunkSize must be a positive number");
  }
  if (!Number.isFinite(chunkOverlap) || chunkOverlap < 0) {
    throw new Error("chunkOverlap must be zero or a positive number");
  }
  if (chunkOverlap >= chunkSize) {
    throw new Error("chunkOverlap must be smaller than chunkSize");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (strategy === "recursive") {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
    const docs = await splitter.createDocuments([text]);
    return docs.map((d) => d.pageContent).filter((c) => c.trim().length > 0);
  }

  if (strategy === "fixed") {
    const chunks: string[] = [];
    const step = chunkSize - chunkOverlap;
    for (let start = 0; start < text.length; start += step) {
      const slice = text.slice(start, start + chunkSize);
      if (slice.trim().length > 0) {
        chunks.push(slice);
      }
      if (start + chunkSize >= text.length) {
        break;
      }
    }
    return chunks;
  }

  throw new Error(`Unsupported chunking strategy: ${strategy}`);
}
