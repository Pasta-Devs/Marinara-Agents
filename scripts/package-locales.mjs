import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const PACKAGE_LOCALE_SCHEMA_REFERENCE = "../../../schemas/package-localization.schema.json";

function localizedPromptTemplates(definition) {
  if (!Array.isArray(definition.promptTemplates)) return undefined;
  const entries = definition.promptTemplates
    .filter((template) => template?.id && (template.name || template.description))
    .map((template) => [
      template.id,
      {
        ...(template.name ? { name: template.name } : {}),
        ...(template.description ? { description: template.description } : {}),
      },
    ]);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function buildEnglishPackageLocale(manifest, agentDefinitions) {
  return {
    $schema: PACKAGE_LOCALE_SCHEMA_REFERENCE,
    _meta: {
      locale: "en",
      direction: "ltr",
    },
    package: {
      name: manifest.name,
      description: manifest.description ?? "",
    },
    agents: Object.fromEntries(
      agentDefinitions.map((definition) => {
        const promptTemplates = localizedPromptTemplates(definition);
        return [
          definition.id,
          {
            name: definition.name,
            description: definition.description ?? "",
            ...(promptTemplates ? { promptTemplates } : {}),
          },
        ];
      }),
    ),
  };
}

export function serializePackageLocale(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

export async function writeEnglishPackageLocale(packageRoot, manifest, agentDefinitions) {
  const localesRoot = join(packageRoot, "locales");
  await mkdir(localesRoot, { recursive: true });
  await writeFile(
    join(localesRoot, "en.json"),
    serializePackageLocale(buildEnglishPackageLocale(manifest, agentDefinitions)),
  );
}
