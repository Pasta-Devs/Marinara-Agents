import { useTranslation as useUiTranslation } from "react-i18next";
import type { AvatarCrop } from "@marinara-engine/shared";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import { NoodlerFrame } from "./SlpHomeHelpers";

export function SlurpWalletView({
  personaId,
  fallbackCoins,
  personaName,
  personaAvatarUrl,
  personaAvatarCrop,
  creatorAvatarCrop,
  onBack,
}: {
  personaId: string | null;
  fallbackCoins: number;
  personaName: string;
  personaAvatarUrl: string | null;
  personaAvatarCrop: AvatarCrop | null;
  creatorAvatarCrop: AvatarCrop | null;
  onBack: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();

  return (
    <NoodlerFrame title={localizeUi("ui.slurp.navigation.wallet")} onBack={onBack}>
      <div className="px-4 py-5 sm:px-6 @min-[1024px]:py-6">
        <div className="flex items-center gap-4 rounded-xl border border-[var(--noodle-divider)] p-4">
          <SlurpCoinAmount amount={fallbackCoins} watchAmount={fallbackCoins} />
          <p className="text-sm text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.wallet.balanceDescription", {
              defaultValue: "Your current slurp coin balance",
            })}
          </p>
        </div>
        <p className="mt-6 text-sm leading-6 text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.wallet.placeholder", {
            defaultValue: "Wallet features coming soon.",
          })}
        </p>
      </div>
    </NoodlerFrame>
  );
}
