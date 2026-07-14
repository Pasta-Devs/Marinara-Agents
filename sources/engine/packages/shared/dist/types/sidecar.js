// ──────────────────────────────────────────────
// Sidecar Local Model Types
//
// Types for the built-in Gemma E2B sidecar that
// handles tracker agents, scene analysis, and
// game mechanics locally.
// ──────────────────────────────────────────────
/** llama.cpp embedding pooling modes accepted by llama-server. */
export const SIDECAR_EMBEDDING_POOLING_TYPES = ["none", "mean", "cls", "last", "rank"];
/** Which runtime target Marinara should prepare for llama.cpp-based local inference. */
export const SIDECAR_RUNTIME_PREFERENCES = ["auto", "nvidia", "amd", "intel", "vulkan", "cpu", "system"];
/** Default sidecar configuration. */
export const SIDECAR_DEFAULT_CONFIG = {
    backend: "llama_cpp",
    modelPath: null,
    modelRepo: null,
    quantization: null,
    customModelRepo: null,
    useForTrackers: false,
    useForGameScene: true,
    contextSize: 8192,
    maxTokens: 4096,
    temperature: 0.3,
    topP: 0.95,
    topK: 64,
    gpuLayers: -1,
    enableNativeToolCalls: true,
    embeddingPooling: "none",
    embeddingBatchSize: 512,
    runtimePreference: "auto",
};
/**
 * Reserved ID for the synthetic sidecar connection entry. The connections
 * storage layer merges this ID into read paths when the sidecar is enabled
 * as a connection, and rejects writes against it. Never stored in the DB.
 */
export const SIDECAR_CONNECTION_ID = "sidecar:local";
export const SIDECAR_SPEECH_DEFAULT_MODEL_ID = "whisper_tiny";
export const SIDECAR_SPEECH_MODELS = [
    {
        id: "whisper_tiny",
        label: "Whisper Tiny (Multilingual)",
        repoId: "Xenova/whisper-tiny",
        sizeBytes: 180_000_000,
        ramBytes: 350_000_000,
        description: "Smallest local call transcription model. Best first choice for phones and older machines.",
    },
    {
        id: "whisper_base",
        label: "Whisper Base (Multilingual)",
        repoId: "Xenova/whisper-base",
        sizeBytes: 320_000_000,
        ramBytes: 650_000_000,
        description: "Better accuracy for messy speech, at the cost of slower startup and higher memory use.",
    },
];
/** Available models for download. */
export const SIDECAR_MODELS = [
    {
        quantization: "q8_0",
        backend: "llama_cpp",
        label: "Gemma 4 E2B — Q8 (Best Quality)",
        filename: "gemma-4-E2B-it-Q8_0.gguf",
        sizeBytes: 5_400_000_000,
        downloadSizeBytes: 5_048_350_848,
        ramBytes: 5_800_000_000,
        downloadUrl: "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q8_0.gguf",
    },
    {
        quantization: "q4_k_m",
        backend: "llama_cpp",
        label: "Gemma 4 E2B — Q4_K_M (Smaller, Faster)",
        filename: "gemma-4-E2B-it-Q4_K_M.gguf",
        sizeBytes: 3_200_000_000,
        downloadSizeBytes: 3_106_736_256,
        ramBytes: 3_600_000_000,
        downloadUrl: "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf",
    },
];
/** Apple Silicon MLX-native curated models. */
export const SIDECAR_MLX_MODELS = [
    {
        quantization: "q8_0",
        backend: "mlx",
        label: "Gemma 4 E2B — 8-bit MLX (Best Quality)",
        filename: "mlx-community/gemma-4-e2b-it-8bit",
        repoId: "mlx-community/gemma-4-e2b-it-8bit",
        sizeBytes: 5_900_000_000,
        ramBytes: 7_500_000_000,
    },
    {
        quantization: "q4_k_m",
        backend: "mlx",
        label: "Gemma 4 E2B — 4-bit MLX (Smaller, Faster)",
        filename: "mlx-community/gemma-4-e2b-it-4bit",
        repoId: "mlx-community/gemma-4-e2b-it-4bit",
        sizeBytes: 3_610_000_000,
        ramBytes: 4_800_000_000,
    },
];
//# sourceMappingURL=sidecar.js.map