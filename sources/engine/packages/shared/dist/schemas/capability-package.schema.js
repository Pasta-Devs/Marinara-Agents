import { z } from "zod";
import { agentResultTypeSchema } from "./agent.schema.js";
export const capabilityPackageKindSchema = z.enum(["agent", "maps", "conversation-calls", "turn-game"]);
export const capabilityPermissionSchema = z.enum([
    "agent-runtime",
    "chat-read",
    "chat-write",
    "network",
    "prompt-context",
    "routes",
    "storage",
    "ui",
]);
export const capabilityPackageManifestSchema = z.object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
    name: z.string().min(1).max(120),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    description: z.string().max(2000).default(""),
    engine: z.object({ min: z.string().min(1), maxExclusive: z.string().min(1) }).strict(),
    kind: z.array(capabilityPackageKindSchema).min(1),
    entrypoints: z
        .object({
        server: z.string().optional(),
        client: z.string().optional(),
        agents: z.string().optional(),
        knowledge: z.string().optional(),
    })
        .strict(),
    contributions: z
        .object({
        slots: z
            .array(z.enum([
            "conversation-surface",
            "conversation-toolbar",
            "chat-settings",
            "spatial-workspace",
        ]))
            .optional(),
        conversationGame: z
            .object({
            command: z.string().regex(/^\/[a-z0-9-]+$/),
            aliases: z.array(z.string().min(1).max(40)).default([]),
            playerLabel: z.string().min(1).max(80),
        })
            .strict()
            .optional(),
    })
        .strict()
        .optional(),
    files: z.array(z.object({
        path: z.string().min(1).max(240),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        bytes: z.number().int().nonnegative().max(100 * 1024 * 1024),
    }).strict()).min(1),
    permissions: z.array(capabilityPermissionSchema),
    restartRequired: z.boolean().default(false),
}).strict();
export const capabilityCatalogPackageSchema = z.object({
    manifest: capabilityPackageManifestSchema,
    artifact: z.object({
        url: z.string().url(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        bytes: z.number().int().positive().max(100 * 1024 * 1024),
    }).strict(),
    iconUrl: z.string().url().optional(),
    documentationUrl: z.string().url().optional(),
}).strict();
export const capabilityCatalogSchema = z.object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    packages: z.array(capabilityCatalogPackageSchema),
}).strict();
export const installedCapabilityPackageSchema = z.object({
    id: z.string(),
    version: z.string(),
    manifest: capabilityPackageManifestSchema,
    installedAt: z.string().datetime(),
    status: z.enum(["active", "restart-required", "error"]),
    error: z.string().nullable(),
    legacy: z.boolean().default(false),
    previousVersion: z.string().optional(),
});
export const installedCapabilityRegistrySchema = z.object({
    schemaVersion: z.literal(1),
    packages: z.array(installedCapabilityPackageSchema),
}).strict();
const packagedAgentPromptTemplateSchema = z.object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    promptTemplate: z.string(),
    description: z.string().optional(),
}).strict();
export const packagedAgentDefinitionSchema = z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
    name: z.string().min(1).max(120),
    description: z.string().max(2000),
    author: z.string().max(120).optional(),
    phase: z.enum(["pre_generation", "parallel", "post_processing"]),
    enabledByDefault: z.boolean(),
    defaultInjectAsSection: z.boolean().optional(),
    category: z.enum(["writer", "tracker", "misc"]),
    libraryHidden: z.boolean().optional(),
    runtimeDisabled: z.boolean().optional(),
    resultType: agentResultTypeSchema.optional(),
    modeAllowlist: z.array(z.enum(["conversation", "roleplay", "visual_novel", "game"])).optional(),
    defaultTools: z.array(z.string()).optional(),
    defaultSettings: z.record(z.string(), z.unknown()).optional(),
    promptTemplates: z.array(packagedAgentPromptTemplateSchema).optional(),
    runInterval: z.number().int().positive().optional(),
    defaultPromptTemplate: z.string(),
    execution: z.enum(["pipeline", "feature"]).optional(),
}).strict();
export const packagedAgentDefinitionsSchema = z.array(packagedAgentDefinitionSchema);
//# sourceMappingURL=capability-package.schema.js.map