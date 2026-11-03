// ──────────────────────────────────────────────
// Otome Forge: the Engine's image style profiles, for the image prompt style picker (Settings → Images and setup)
// ──────────────────────────────────────────────
// GET /image-style-profiles reads them through the server (S/art/image-client.ts styleProfiles), which already reads
// them to paint; a list that cannot be read is empty, and the picker then offers only the Engine's default.
import { useQuery } from "@tanstack/react-query";
import { useOtomeApi } from "../api";

export interface ImageStyleProfileOption {
  id: string;
  name: string;
  /** The Engine's promptMode: "natural", "tagged", "danbooru" or "hybrid". */
  promptMode: string;
}

export interface ImageStyleProfiles {
  defaultProfileId: string;
  profiles: ImageStyleProfileOption[];
}

export function useImageStyleProfiles() {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: ["otome-forge", "engine", "image-style-profiles"] as const,
    queryFn: () => otome.get<ImageStyleProfiles>("/image-style-profiles"),
    staleTime: 30_000,
  });
}
