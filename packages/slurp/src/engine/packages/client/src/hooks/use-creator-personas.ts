import { useQuery } from "@tanstack/react-query";
import type { Persona } from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export function usePersonas() {
  return useQuery({
    queryKey: ["slurp", "creator", "personas"],
    queryFn: () => api.get<Persona[]>("/characters/personas/list"),
    staleTime: 5 * 60_000,
  });
}

export function useActivePersona() {
  return useQuery({
    queryKey: ["slurp", "creator", "active-persona"],
    queryFn: () => api.get<Persona | null>("/characters/personas/active"),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useCharacterGroups() {
  return useQuery({
    queryKey: ["slurp", "creator", "character-groups"],
    queryFn: () => api.get<unknown[]>("/characters/groups/list"),
  });
}
