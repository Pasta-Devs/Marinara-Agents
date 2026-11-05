// Big Cheese M4 T7: one-tap story bundles (modules.md section 2). A bundle sets the dials it names, nothing else.
export const BUNDLES = [
  { id: "soap", key: "ui.bigCheese.t7.bundle.soap", layers: { drama: 70, romance: 70, press: 70 } },
  { id: "dark", key: "ui.bigCheese.t7.bundle.dark", layers: { crime: 70, horror: 70, mystery: 70 } },
  { id: "cosy", key: "ui.bigCheese.t7.bundle.cosy", layers: { family: 70, romance: 25 } },
  { id: "power", key: "ui.bigCheese.t7.bundle.power", layers: { politics: 70, rivals: 70, legacy: 70 } },
] as const;
