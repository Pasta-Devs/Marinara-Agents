import type { FastifyPluginAsync } from "fastify";
import {
  PhoneIdentityService,
  type EnsurePhoneInput,
  type PhoneBaselineTheme,
  type PhoneOwnerType,
} from "../device/identity";
import { normalizeDeviceSettings, type DeviceSettings } from "../device/settings";

interface CapabilityContext {
  api: {
    runtime: {
      persistence: {
        documents: ConstructorParameters<typeof PhoneIdentityService>[0];
        getChat(chatId: string): Promise<{
          id: string;
          personaId: string | null;
          characterIds: string[];
        } | null>;
      };
      resources: {
        listCharacters(ids?: string[]): Promise<Array<{ id: string; data: unknown }>>;
        listPersonas(ids?: string[]): Promise<Array<{ id: string; data: unknown }>>;
      };
    };
    registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void>;
  };
}

function readTheme(value: unknown): PhoneBaselineTheme {
  if (value === "system" || value === "light" || value === "dark") return value;
  throw new Error("baselineTheme must be system, light, or dark");
}

function readName(value: unknown, fallback: string) {
  if (typeof value === "string") {
    try {
      return readName(JSON.parse(value), fallback);
    } catch {
      return fallback;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const data = value as Record<string, unknown>;
  if (typeof data.name === "string" && data.name.trim()) return data.name.trim();
  return readName(data.data, fallback);
}

function phoneResponse(phone: Awaited<ReturnType<PhoneIdentityService["ensure"]>>) {
  return {
    ...phone.document.identity,
    ...phone.document.provisioning,
    settings: normalizeDeviceSettings(phone.document.namespaces.phone.settings, phone.document.provisioning.baselineTheme),
  };
}

function readOwnerType(value: unknown): PhoneOwnerType {
  if (value === "persona" || value === "character") return value;
  throw new Error("ownerType must be persona or character");
}

function readEnsureInput(value: unknown): EnsurePhoneInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Request body is required");
  const body = value as Record<string, unknown>;
  return {
    ownerId: String(body.ownerId ?? ""),
    ownerType: readOwnerType(body.ownerType),
    ownerName: String(body.ownerName ?? ""),
    chatId: String(body.chatId ?? ""),
    ...(body.deviceName === undefined ? {} : { deviceName: body.deviceName === null ? null : String(body.deviceName) }),
    ...(body.enabled === undefined ? {} : { enabled: body.enabled === true }),
    ...(body.baselineTheme === undefined ? {} : { baselineTheme: readTheme(body.baselineTheme) }),
  };
}

export async function activate({ api }: CapabilityContext) {
  const phones = new PhoneIdentityService(api.runtime.persistence.documents);
  await phones.migrateLegacyDocuments();
  const routes: FastifyPluginAsync = async (app) => {
    app.get("/phones", async () => ({ phones: (await phones.list()).map(phoneResponse) }));
    app.get<{ Params: { ownerType: string; ownerId: string } }>("/phones/:ownerType/:ownerId", async (request, reply) => {
      try {
        const phone = await phones.get(readOwnerType(request.params.ownerType), request.params.ownerId);
        if (!phone) return reply.status(404).send({ error: "Phone not found" });
        return { phone: { ...phone.document.identity, ...phone.document.provisioning } };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid phone request" });
      }
    });
    app.post("/phones", async (request, reply) => {
      try {
        const phone = await phones.ensure(readEnsureInput(request.body));
        return { phone: phoneResponse(phone) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid phone request" });
      }
    });
    app.get<{ Params: { chatId: string } }>("/chats/:chatId/phones", async (request, reply) => {
      const chat = await api.runtime.persistence.getChat(request.params.chatId);
      if (!chat) return reply.status(404).send({ error: "Chat not found" });
      const [personas, characters] = await Promise.all([
        chat.personaId ? api.runtime.resources.listPersonas([chat.personaId]) : Promise.resolve([]),
        api.runtime.resources.listCharacters(chat.characterIds),
      ]);
      const persona = personas[0];
      const personaPhone = persona
        ? await phones.ensure({
            ownerId: persona.id,
            ownerType: "persona",
            ownerName: readName(persona.data, "Persona"),
            chatId: chat.id,
            enabled: true,
          })
        : null;
      const existing = await phones.list();
      const existingByOwner = new Map(
        existing.map((phone) => [`${phone.document.identity.ownerType}:${phone.document.identity.ownerId}`, phone]),
      );
      return {
        persona: personaPhone ? phoneResponse(personaPhone) : null,
        characters: characters.map((character) => {
          const phone = existingByOwner.get(`character:${character.id}`);
          return {
            ownerId: character.id,
            ownerName: readName(character.data, "Character"),
            phone: phone ? phoneResponse(phone) : null,
          };
        }),
      };
    });
    app.put<{ Params: { chatId: string; ownerType: string; ownerId: string } }>(
      "/chats/:chatId/phones/:ownerType/:ownerId",
      async (request, reply) => {
        try {
          const ownerType = readOwnerType(request.params.ownerType);
          const chat = await api.runtime.persistence.getChat(request.params.chatId);
          if (!chat) return reply.status(404).send({ error: "Chat not found" });
          const allowed = ownerType === "persona"
            ? chat.personaId === request.params.ownerId
            : chat.characterIds.includes(request.params.ownerId);
          if (!allowed) return reply.status(404).send({ error: "Owner is not available in this chat" });
          const records = ownerType === "persona"
            ? await api.runtime.resources.listPersonas([request.params.ownerId])
            : await api.runtime.resources.listCharacters([request.params.ownerId]);
          const owner = records[0];
          if (!owner) return reply.status(404).send({ error: "Owner not found" });
          const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
            ? request.body as Record<string, unknown>
            : {};
          const phone = await phones.ensure({
            ownerId: owner.id,
            ownerType,
            ownerName: readName(owner.data, ownerType === "persona" ? "Persona" : "Character"),
            chatId: chat.id,
            ...(body.enabled === undefined ? {} : { enabled: body.enabled === true }),
            ...(body.baselineTheme === undefined ? {} : { baselineTheme: readTheme(body.baselineTheme) }),
          });
          return { phone: phoneResponse(phone) };
        } catch (error) {
          return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid phone request" });
        }
      },
    );
    app.patch<{ Params: { phoneId: string } }>("/phones/:phoneId/settings", async (request, reply) => {
      try {
        const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? request.body as Partial<DeviceSettings>
          : {};
        const phone = await phones.updateSettings(request.params.phoneId, body);
        return { phone: phoneResponse(phone) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid device settings" });
      }
    });
    app.post<{ Params: { phoneId: string } }>("/phones/:phoneId/settings/reset", async (request, reply) => {
      try {
        return { phone: phoneResponse(await phones.resetSettings(request.params.phoneId)) };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Unable to reset device settings" });
      }
    });
  };
  return api.registerPrivilegedRoutes(routes, { prefix: "/api/virtual-phone" });
}

export async function selfCheck({ api }: CapabilityContext) {
  if (!api.runtime.persistence.documents) throw new Error("Virtual Phone persistence is unavailable");
}
