# File Map

## Root
- `server.js`: Express entrypoint, middleware, health route, route mounting, compile rate limiter.
- `package.json`: npm scripts, Node engine, dependencies.
- `package-lock.json`: local dependency lockfile; gitignored.
- `README.md`: minimal title only.
- `.gitignore`: ignores IDE files, `node_modules`, `package-lock.json`, `toolchains`, and `downloads`.

## Configuration
- `config/boards.json`: board ID to compiler metadata map; primary source for supported boards.

## Routes
- `routes/compile.js`: `POST /compile`; validates request, creates job folder, dispatches to compiler modules, shapes compile responses.
- `routes/download.js`: generated artifact downloads and desktop installer downloads; handles job cleanup after download.
- `routes/firmwares.js`: firmware listing, Nethub firmware manifest, firmware streaming.
- `routes/RuntimeLibsRoute.js`: runtime library listing and streaming.

## Compiler Services
- `compilers/arduino.js`: Arduino AVR compile with Arduino CLI; `.hex` output.
- `compilers/esp.js`: ESP32/ESP8266 Arduino compile with Arduino CLI; returns app/bootloader/partitions/flash args.
- `compilers/pico.js`: Raspberry Pi Pico Arduino CLI compile; `.uf2` output.
- `compilers/microbit.js`: Micro:bit PlatformIO compile; `.hex` output.
- `compilers/maix.js`: Kendryte K210/Maix PlatformIO compile; `.bin` output.
- `compilers/nethub.js`: Nethub MicroPython preparation and `.mpy` compilation.

## Shared Libraries
- `lib/runtimeLibs.js`: runtime library directory config, Nethub runtime lib list, compatibility validation.
- `lib/nethubSupport.js`: Nethub upload metadata, USB serial adapter IDs, firmware manifest ordering.

## Static Assets
- `runtime-libs/`: MicroPython libraries served to clients and injected for Nethub compile.
- `runtime-libs/ir_rx/`: IR receiver MicroPython package included in Nethub compile/runtime library handling and uploaded to `/lib/ir_rx/`.
- `firmwares/README.md`: firmware package notes.
- `firmwares/arduino/`: bundled Arduino `.hex` firmware files.
- `firmwares/microPython/`: bundled MicroPython/Maix `.bin` firmware files.
- `downloads/desktop/`: local/deployed desktop `.exe` builds; ignored by git.

## Toolchains
- `toolchains/arduino-cli/arduino-cli.yaml`: Arduino CLI configuration with ESP8266, ESP32, and RP2040 board manager URLs plus production data/download/user paths.
- `toolchains/arduino-cli/user/libraries/`: local Arduino library bundle when present; ignored by git and very large.
- `toolchains/micropython/mpy-cross/build/mpy-cross`: default expected Nethub compiler path; not present in tracked file list.

## Documentation
- `docs/nethub-cp2102-driver.md`: Nethub CP2102/CH340 driver setup and upload metadata notes.
- `docs/PROJECT_OVERVIEW.md`: business purpose, features, and user flows.
- `docs/ARCHITECTURE.md`: technical architecture, API contracts, compiler flow, storage/security.
- `docs/DEVELOPER_GUIDE.md`: setup, run/build/test guidance, change rules.
- `docs/FILE_MAP.md`: this file.

## Generated / Runtime
- `temp/jobs/<jobId>/`: generated compile workspaces and artifacts; created on demand, not listed in current tracked files.
- `node_modules/`: installed npm dependencies; ignored by git.
- `.idea/`: local IDE settings; ignored by git.
