import { z } from "zod";
import { chatModeSchema } from "./chat.schema.js";
const nonEmptyIdSchema = z.string().min(1);
const createFolderNameSchema = z.string().trim().min(1);
const updateFolderNameSchema = z.string().trim().min(1, "Name is required");
const folderColorSchema = z.string();
const uniqueIdsSchema = z.array(nonEmptyIdSchema).superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "IDs must be unique",
        });
    }
});
export const folderIdParamsSchema = z.object({
    id: nonEmptyIdSchema,
});
export const createConnectionFolderSchema = z.object({
    name: createFolderNameSchema,
    color: folderColorSchema.optional(),
});
export const createChatFolderSchema = createConnectionFolderSchema.extend({
    mode: chatModeSchema,
});
export const updateFolderSchema = z.object({
    name: updateFolderNameSchema.optional(),
    color: folderColorSchema.optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    collapsed: z.boolean().optional(),
});
export const reorderFoldersSchema = z.object({
    orderedIds: uniqueIdsSchema,
});
export const moveChatToFolderSchema = z.object({
    chatId: nonEmptyIdSchema,
    folderId: nonEmptyIdSchema.nullable(),
});
export const reorderChatsInFolderSchema = z.object({
    orderedChatIds: uniqueIdsSchema,
    folderId: nonEmptyIdSchema.nullable(),
});
export const moveConnectionToFolderSchema = z.object({
    connectionId: nonEmptyIdSchema,
    folderId: nonEmptyIdSchema.nullable(),
});
export const reorderConnectionsInFolderSchema = z.object({
    orderedConnectionIds: uniqueIdsSchema,
    folderId: nonEmptyIdSchema.nullable(),
});
//# sourceMappingURL=folder.schema.js.map