import { useTranslation as useUiTranslation } from "react-i18next";
import type {
  SlpBulkCreatorAccountCreateInput,
  SlpStageProfileDraftRequest,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type {
  SlpAccount,
  SlpCreatorManagedStageProfile,
  SlpCreatorSourceSnapshot,
  SlpCreatorStageProfile,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpManagedStageProfile, SlurpStageProfileInput } from "../../base/state/slp-state-types.js";

export function useCreateCreatorStageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceAccountId,
      stageProfile,
    }: {
      sourceAccountId: string;
      stageProfile: SlurpStageProfileInput;
    }) =>
      api.post<SlurpManagedStageProfile>(`/slurp2/accounts/${encodeURIComponent(sourceAccountId)}/noodler`, {
        stageProfile,
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        qc.invalidateQueries({
          queryKey: slpKeys.noodlerEligibleAccountsRoot(),
        }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
      ]),
  });
}
export function useBulkCreateCreatorStageProfiles() {
  const qc = useQueryClient();
  const { t: localizeUi } = useUiTranslation();
  return useMutation({
    mutationFn: (
      input: SlpBulkCreatorAccountCreateInput & {
        connectionId?: string | null;
      },
    ) =>
      api.post<{
        created: SlurpManagedStageProfile[];
        skipped: string[];
        failed?: string[];
        reasons?: { accountId: string; reason: string }[];
      }>("/slurp2/slurp/accounts/bulk", input),
    onSuccess: (result) => {
      const failed = result.failed?.length ?? 0;
      const counts = {
        value1: result.created.length,
        value2: result.skipped.length,
        value3: failed,
      };
      if (failed) {
        toast.error(localizeUi("ui.noodle.noodlerbulkcreatepanel.createdValue1SkippedValue2FailedValue3", counts));
      } else {
        toast.success(localizeUi("ui.noodle.noodlerbulkcreatepanel.createdValue1SkippedValue2", counts));
      }
      return Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        qc.invalidateQueries({
          queryKey: slpKeys.noodlerEligibleAccountsRoot(),
        }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
      ]);
    },
  });
}
export function useUpdateCreatorStageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      sourceSnapshot,
      ...input
    }: {
      accountId: string;
      acceptSourceChanges?: boolean;
      sourceSnapshot?: SlpCreatorSourceSnapshot;
      sourceRevisionToken?: string;
      confirmAvatarReview?: boolean;
    } & SlurpStageProfileInput) =>
      api.put<SlurpManagedStageProfile>(`/slurp2/slurp/accounts/${encodeURIComponent(accountId)}/stage-profile`, {
        ...input,
        ...(sourceSnapshot ? { sourceSnapshot } : {}),
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
        qc.invalidateQueries({ queryKey: slpKeys.noodlerReserveStatus() }),
      ]),
  });
}
export function useUpdateCreatorProfileLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; personaId: string; location: string }) =>
      api.patch<SlpCreatorStageProfile>(`/slurp2/accounts/${encodeURIComponent(input.accountId)}/profile`, {
        personaId: input.personaId,
        profile: { location: input.location },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
  });
}
function useCreatorAvatarMutation<TInput extends { accountId: string }>(
  mutationFn: (input: TInput) => Promise<SlpCreatorStageProfile>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
        qc.invalidateQueries({ queryKey: slpKeys.noodlerReserveStatus() }),
      ]),
  });
}
export function useUploadCreatorAvatar() {
  return useCreatorAvatarMutation(({ accountId, file }: { accountId: string; file: File }) => {
    const form = new FormData();
    form.append("payload", "{}");
    form.append("file", file);
    return api.upload<SlpCreatorStageProfile>(`/slurp2/slurp/accounts/${encodeURIComponent(accountId)}/avatar`, form);
  });
}
export function useUploadCreatorBanner() {
  return useCreatorAvatarMutation(({ accountId, file }: { accountId: string; file: File }) => {
    const form = new FormData();
    form.append("payload", "{}");
    form.append("file", file);
    return api.upload<SlpCreatorStageProfile>(`/slurp2/slurp/accounts/${encodeURIComponent(accountId)}/banner`, form);
  });
}
export function useGenerateCreatorArtwork() {
  return useCreatorAvatarMutation(
    ({ accountId, kind, guidance }: { accountId: string; kind: "avatar" | "banner"; guidance?: string }) =>
      api.post<SlpCreatorStageProfile>(`/slurp2/slurp/accounts/${encodeURIComponent(accountId)}/artwork/generate`, {
        kind,
        guidance,
      }),
  );
}
export function useUseCreatorSourceAvatar() {
  return useCreatorAvatarMutation(({ accountId }) =>
    api.patch<SlpCreatorStageProfile>(`/slurp2/slurp/accounts/${encodeURIComponent(accountId)}/avatar/source`, {}),
  );
}
export function useRemoveCreatorAvatar() {
  return useCreatorAvatarMutation(({ accountId }) =>
    api.delete<SlpCreatorStageProfile>(`/slurp2/slurp/accounts/${encodeURIComponent(accountId)}/avatar`),
  );
}
function useCreatorSourceAction(action: "dismiss" | "adopt-identity") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<SlpCreatorManagedStageProfile>(
        `/slurp2/slurp/accounts/${encodeURIComponent(accountId)}/source/${action}`,
        {},
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
        qc.invalidateQueries({ queryKey: slpKeys.noodlerReserveStatus() }),
      ]),
  });
}
export function useDismissCreatorSourceChanges() {
  return useCreatorSourceAction("dismiss");
}
export function useAdoptCreatorSourceIdentity() {
  return useCreatorSourceAction("adopt-identity");
}
export function useDeleteCreatorStageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.delete<SlpAccount>(`/slurp2/slurp/accounts/${encodeURIComponent(accountId)}`),
    onSuccess: (_account, accountId) => {
      qc.removeQueries({ queryKey: slpKeys.noodlerPosts(accountId) });
      return Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        qc.invalidateQueries({
          queryKey: slpKeys.noodlerEligibleAccountsRoot(),
        }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
      ]);
    },
  });
}
export function useGenerateCreatorStageProfileDraft() {
  return useMutation({
    mutationFn: (input: SlpStageProfileDraftRequest) => {
      const controller = new AbortController();
      // ponytail: fixed 60s ceiling, no per-provider tuning — raise if real drafts routinely take longer
      const timer = setTimeout(() => controller.abort(), 60_000);
      return api
        .post<
          SlurpStageProfileInput & {
            sourceSnapshot?: SlpCreatorSourceSnapshot;
            sourceRevisionToken?: string;
            /** What the server repaired or still needs. Shown once, never saved. */
            notes?: string[];
          }
        >("/slurp2/slurp/stage-profile-draft", input, {
          signal: controller.signal,
        })
        .finally(() => clearTimeout(timer));
    },
  });
}
