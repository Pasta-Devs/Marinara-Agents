// ──────────────────────────────────────────────
// Big Cheese: Place, the room list (ui.md §5.11)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import type { Ctx } from "./parts";

export function Place({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.place.title")}
      </h1>
      <ul className="bc-list">
        {ctx.kit.rooms.map((room) => (
          <li key={room.id} className="bc-panel">
            <h2 className="bc-row-title">{room.name}</h2>
            <p className="bc-muted">{room.text}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
