import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";

export function useSlurpConnections(enabled = true) {
  return useQuery({
    queryKey: ["slurp", "connections"],
    queryFn: () =>
      api.get<
        Array<{
          id: string;
          name?: string;
          model?: string;
          provider?: string;
          defaultForAgents?: string | boolean;
          isDefault?: string | boolean;
        }>
      >("/connections"),
    enabled,
    staleTime: 5 * 60_000,
  });
}
