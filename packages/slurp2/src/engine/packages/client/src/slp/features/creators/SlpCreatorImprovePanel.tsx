import { SlurpCreatorImprover } from "../../../components/slurp/SlurpCreatorImprover";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Improve with AI: review and apply suggested changes to a Creator. */
export function SlpCreatorImprovePanel({ creators, settings }: SlpBackstagePageProps) {
  return <SlurpCreatorImprover creators={creators} settings={settings} />;
}
