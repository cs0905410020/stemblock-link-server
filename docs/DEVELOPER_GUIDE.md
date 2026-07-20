# Developer Guide

## Prerequisites
- Node.js `>=18`.
- npm.
- Arduino CLI installed and configured with AVR, ESP32/ESP8266, and RP2040 cores.
- PlatformIO CLI available as `pio` for Micro:bit and K210/Maix builds.
- `mpy-cross` for Nethub builds.
- Production deployment currently assumes `/var/www/html/stemblock-link/toolchains/arduino-cli/...` for Arduino AVR/ESP compilers.
- Sylvie servo sketches use `#include <Servo.h>`; the Arduino AVR core/toolchain must provide the Servo library and return a compiled `.hex` artifact before upload can begin.

## Install
```bash
npm install
```

## Run
```bash
npm run dev
```

```bash
npm start
```

Defaults:
- Port: `20111` unless `PORT` is set.
- Environment variables loaded through `dotenv`.

## Useful Environment Variables
- `PORT`: Express listen port.
- `NODE_ENV`: set by npm scripts.
- `MPY_CROSS`: optional absolute/relative path to `mpy-cross`.
- `RUNTIME_LIBS_DIR`: optional path to MicroPython runtime libraries.

No `.env` file was found in the repo. Needs verification for production values.

## Scripts
- `npm start`: production start with `NODE_ENV=production PORT=20111 node server.js`.
- `npm run dev`: development start with `nodemon`.
- `npm run lint`: runs `eslint .`.
- `npm run clean`: removes `temp/jobs/*` using Unix `rm -rf`; may need adjustment on Windows.

## Manual API Checks
- Health:
```bash
curl http://localhost:20111/health
```

- Compile:
```bash
curl -X POST http://localhost:20111/compile \
  -H "Content-Type: application/json" \
  -d '{"board":"arduinoUno","code":"void setup(){} void loop(){}"}'
```

- Firmware list:
```bash
curl http://localhost:20111/firmwares
```

- Nethub manifest:
```bash
curl "http://localhost:20111/firmwares/nethub/manifest?chip=esp32"
```

- Runtime libraries:
```bash
curl http://localhost:20111/runtime-libs
```

## Testing Strategy
- No automated test files or test script were found.
- For route changes, use focused curl/API checks.
- For compiler changes, verify with at least one representative board for the affected compiler family. For Sylvie servo changes, include a sketch with `#include <Servo.h>` and confirm `/compile` returns `type: "avr"` plus `hexPath`.
- For Nethub changes, verify both `/compile` response metadata and `/firmwares/nethub/manifest`.
- For download changes, verify path validation and cleanup behavior.

## Safe Change Patterns
- Add board support by editing `config/boards.json`, then ensure `routes/compile.js` can route its `type`.
- Keep compile response shape stable; external clients likely depend on current fields and `/stemblock/...` URL prefixes.
- Prefer `execFile` over shell-string `exec` when adding new toolchain invocations.
- Keep temp output under `temp/jobs/<jobId>`.
- Validate filenames and use `path.relative`/`path.basename` before serving files.
- Update docs when changing API contracts, board config, compiler output, toolchain requirements, runtime libraries, firmware assets, or deployment assumptions.

## Coding Conventions
- CommonJS `require`/`module.exports`.
- Mostly small route/compiler modules.
- Synchronous filesystem operations are used inside request/compiler flows.
- Error responses are compact JSON for API routes; file routes sometimes use plain text.
- Existing code uses 4-space indentation.

## Known Risks
- Hard-coded Linux production paths in Arduino AVR/ESP compilers reduce portability.
- `npm run clean` uses Unix syntax and may fail on Windows PowerShell.
- `package-lock.json`, `toolchains`, and `downloads` are gitignored but present locally; do not assume all environments have them.
- No CI/test harness is documented.
