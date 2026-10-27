import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import type { SaucelingFormResponse, SaucelingPet } from "../../../../shared/src/features/agents/saucelings/types.js";
import { spriteArtFor } from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { saucelingsRequest } from "./api.js";
import { SaucelingSprite } from "./SaucelingSprite.js";

type PetArt = Pick<SaucelingPet, "design" | "forms" | "evolution">;

/** One form's pictures: its own request, so the state stays small, and it loads once per form. `front` asks for
 *  the front strip only, for lists and references. */
export const formQuery = (id: string, front = false) => ({
  queryKey: ["saucelings", "form", id, front ? "front" : "all"],
  queryFn: () =>
    saucelingsRequest<SaucelingFormResponse>(`/form/${encodeURIComponent(id)}${front ? "?strips=front" : ""}`),
  staleTime: Infinity,
});

/** A `SaucelingSprite` that picks its picture from the sauceling's design and forms: the painted form for the
 *  stage once it loads (its mood strip and side view when it has them), a silhouette meanwhile for a found
 *  sauceling, the species sprite for an evolved one, drawn in its evolved look when it has one. `frontOnly` loads
 *  the front strip alone, for lists. */
export function PetSprite({
  art,
  frontOnly = false,
  ...props
}: Omit<ComponentProps<typeof SaucelingSprite>, "customSrc" | "sideSrc" | "frames" | "silhouette" | "look"> & {
  art: PetArt;
  frontOnly?: boolean;
}) {
  const choice = spriteArtFor(art, props.stage);
  const formId = choice.kind === "form" ? choice.formId : null;
  const form = useQuery({ ...formQuery(formId ?? "", frontOnly), enabled: formId !== null });
  const strips = formId ? (form.data ?? null) : null;
  const image = strips ? ((props.mood === "content" ? null : strips[props.mood]) ?? strips.image) : null;
  // While the form loads or if it fails, a found sauceling shows its silhouette and an evolved one its species sprite.
  const silhouette = !image && (choice.kind === "silhouette" || (formId !== null && art.design?.origin === "found"));
  return (
    <SaucelingSprite
      {...props}
      customSrc={image}
      sideSrc={strips?.side ?? null}
      frames={strips?.frames ?? 1}
      silhouette={silhouette}
      look={art.evolution?.look ?? null}
    />
  );
}
