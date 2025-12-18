import { EmbedContentParameters, GoogleGenAI } from "@google/genai";
import { AppConfig } from "../config.js";

export interface ChatMessage {
  role: string;
  parts: { text: string }[];
}

export interface EmbeddingOptions {
  taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
  title?: string;
}

export interface AIService {
  getEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]>;
  generateResponseStream(
    context: string,
    query: string,
    systemInstruction?: string,
    history?: ChatMessage[]
  ): AsyncGenerator<string, void, unknown>;
  generateResponse(
    context: string,
    query: string,
    systemInstruction?: string
  ): Promise<string>;
}

function createGenAIClient(cfg: AppConfig): GoogleGenAI {
  if (cfg.ai.provider === "gemini") {
    if (!cfg.ai.geminiApiKey) {
      throw new Error(
        "GEMINI_API_KEY is required when AI_PROVIDER=gemini. Refusing to fall back to mock vectors."
      );
    }
    return new GoogleGenAI({ apiKey: cfg.ai.geminiApiKey });
  }

  if (!cfg.ai.projectId) {
    throw new Error(
      "PROJECT_ID is required when AI_PROVIDER=vertex. Refusing to fall back to mock vectors."
    );
  }
  return new GoogleGenAI({
    vertexai: true,
    project: cfg.ai.projectId,
    location: cfg.ai.region,
  });
}

export function createAIService(cfg: AppConfig): AIService {
  let client: GoogleGenAI | null = null;
  const getClient = () => {
    if (!client) {
      client = createGenAIClient(cfg);
    }
    return client;
  };

  async function getEmbedding(
    text: string,
    options?: EmbeddingOptions
  ): Promise<number[]> {
    const ai = getClient();
    const taskType = options?.taskType || "RETRIEVAL_DOCUMENT";
    const config: EmbedContentParameters = {
      model: cfg.ai.embeddingModel,
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        taskType,
        ...(taskType === "RETRIEVAL_DOCUMENT" && options?.title
          ? { title: options.title }
          : {}),
        outputDimensionality: 768,
      },
    };

    const result = await ai.models.embedContent(config);
    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error("Embedding provider returned an empty vector");
    }
    return values;
  }

  async function* generateResponseStream(
    context: string,
    query: string,
    systemInstruction?: string,
    history: ChatMessage[] = []
  ): AsyncGenerator<string, void, unknown> {
    const ai = getClient();
    const contents = [
      ...history,
      {
        role: "user",
        parts: [
          {
            text: context
              ? `Context:\n${context}\n\nQuestion:\n${query}`
              : `Context:\n(No relevant document passages retrieved.)\n\nQuestion:\n${query}`,
          },
        ],
      },
    ];

    const req: {
      model: string;
      contents: ChatMessage[];
      config: {
        maxOutputTokens: number;
        temperature: number;
        topP: number;
        systemInstruction?: { parts: { text: string }[] };
      };
    } = {
      model: cfg.ai.chatModel,
      contents,
      config: {
        maxOutputTokens: 2048,
        temperature: 0.2,
        topP: 0.95,
      },
    };

    if (systemInstruction) {
      req.config.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const streamResult = await ai.models.generateContentStream(req);
    for await (const chunk of streamResult) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  async function generateResponse(
    context: string,
    query: string,
    systemInstruction?: string
  ): Promise<string> {
    let fullText = "";
    for await (const chunk of generateResponseStream(
      context,
      query,
      systemInstruction
    )) {
      fullText += chunk;
    }
    return fullText;
  }

  return {
    getEmbedding,
    generateResponseStream,
    generateResponse,
  };
}
