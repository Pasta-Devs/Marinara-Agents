export type LtmModelMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type LtmModelOptions = {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  verbosity?: "low" | "medium" | "high";
  signal?: AbortSignal;
  responseFormat?: Readonly<{ type: string; [key: string]: unknown }>;
  debugMode?: boolean;
};

export type LtmModelResult = {
  content: string | null;
  finishReason: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    completionReasoningTokens?: number;
    totalTokens?: number;
  };
};

export type LtmModelContextFit = {
  maxTokens?: number;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  trimmed: boolean;
};

export type LongTermMemoryExtractionModel = {
  name: string;
  maxContext: number | null;
  maxOutputTokens: number | null;
  complete(messages: LtmModelMessage[], options: LtmModelOptions): Promise<LtmModelResult>;
  fitContext(messages: LtmModelMessage[], options: LtmModelOptions): LtmModelContextFit;
};
