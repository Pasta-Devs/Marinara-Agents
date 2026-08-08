import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export const PACKAGE_LOCALE_SCHEMA_REFERENCE = "../../../schemas/package-localization.schema.json";

export async function readPackageManifest(packageRoot) {
  try {
    return JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function resolvePackageOwnedPath(packageRoot, packagePath, label) {
  if (typeof packagePath !== "string" || packagePath.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  const resolvedRoot = await realpath(resolve(packageRoot));
  const resolvedPath = await realpath(resolve(resolvedRoot, packagePath));
  const relativePath = relative(resolvedRoot, resolvedPath);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`${label} must remain inside ${resolvedRoot}`);
  }
  return resolvedPath;
}

export async function readPackageAgentDefinitions(packageRoot, manifest) {
  const agentsPath = await resolvePackageOwnedPath(
    packageRoot,
    manifest.entrypoints?.agents,
    `${manifest.id ?? packageRoot} Agent entrypoint`,
  );
  return JSON.parse(await readFile(agentsPath, "utf8"));
}

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
      ...(manifest.description === undefined ? {} : { description: manifest.description }),
    },
    agents: Object.fromEntries(
      agentDefinitions.map((definition) => {
        const promptTemplates = localizedPromptTemplates(definition);
        return [
          definition.id,
          {
            name: definition.name,
            ...(definition.description === undefined ? {} : { description: definition.description }),
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
