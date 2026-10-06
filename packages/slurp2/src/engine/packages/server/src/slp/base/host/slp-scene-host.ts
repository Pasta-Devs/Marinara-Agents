/**
 * Whether this Engine runs Slurp's roleplay scenes (docs/SCENES.md): set when activation registers the
 * scene origin, cleared on teardown. The thread view reads it to offer "Start a scene".
 */
let scenesAvailable = false;

export function setSlpScenesAvailable(value: boolean): void {
  scenesAvailable = value;
}

export function slpScenesAvailable(): boolean {
  return scenesAvailable;
}
