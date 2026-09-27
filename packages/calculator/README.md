# Calculator

A homescreen calculator where every Calculate action asks your selected text model to do the math.

Install the package, restart Marinara Engine, then open **Home → Calculator**. Choose a **Text connection**, type an expression or use the keypad, and select **Calculate** (or press Enter). Repeated expressions always make a fresh model request. Results appear as plain text; expressions are never evaluated locally.

The selector lists text connections only and remembers your choice in this browser. Add or edit connections in Engine Settings. Failed requests show an error and can be retried. Calculation results are kept only while the tab is open. Closing the tab cancels its request.

The package uses the Engine language-model host and privileged package routes. It does not read or write chats, characters, personas, or lorebooks. Install/update requires a restart for the server route; uninstall revokes the route and removes the Home tab.

## Development

Build: `heavy node scripts/build-calculator-package.mjs`.

Regression proof: `heavy node tests/calculator.regression.mjs`.

Browser proof: `MARINARA_ENGINE_ROOT=/path/to/Marinara-Engine heavy node scripts/run-package-browser-tests.mjs calculator tests/package-calculator.e2e.ts`.
