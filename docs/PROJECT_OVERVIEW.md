# Project Overview

## Metadata

- Last Updated: 2026-05-24
- Updated By: Codex Agent
- Change Summary: Updated Nethub IR runtime dependency target to /lib/ir_rx

## Purpose
- Stemblock Link Server is a backend compile and asset service for Stemblock hardware programming flows.
- It receives source code from a client, compiles or prepares board-specific artifacts, and returns download URLs for flashing/upload.
- It also serves bundled firmware images, desktop installer downloads, and MicroPython runtime libraries.

## Main User Flows
- Compile board code:
  1. Client sends `POST /compile` with `{ board, code }`.
  2. Server looks up board metadata in `config/boards.json`.
  3. Server creates `temp/jobs/<type><uuid>`.
  4. Matching compiler module writes source files and invokes a local toolchain.
  5. Server returns artifact URLs under `/stemblock/download/...`.
- Download generated artifact:
  1. Client calls `/download/:jobId/:filename` or `/download/:jobId`.
  2. Server streams artifact from the job folder.
  3. Job folder is deleted after a short delay.
- Nethub MicroPython flow:
  1. Client compiles Python code for board `nethub`.
  2. Server injects selected runtime libraries and compiles `.py` files to `.mpy`.
  3. If code imports `ir_rx` or uses `NEC_8`, the server normalizes old `import ir_rx.nec` / `ir_rx.nec.NEC_8(...)` code to `from ir_rx.nec import NEC_8` / `NEC_8(...)`.
  4. The complete `ir_rx` package is included in the ordered runtime file list under `/lib/ir_rx`, and `main.py` is prepended with a bootstrap that writes `/lib/ir_rx/*.py` before imports execute.
  5. Response includes `main.py`, `main.mpy`, injected runtime library artifact URLs, target device paths, and upload metadata for USB serial flashing/retry behavior.
  6. Client can request `/firmwares/nethub/manifest?chip=esp32` for firmware candidates and upload metadata.
- Runtime library flow:
  1. Client lists `/runtime-libs`.
  2. Client fetches selected flat or nested `.py` libraries through `/runtime-libs/:filename` or `/runtime-libs/<package>/<filename>`.
- Desktop download flow:
  1. Client lists `/download/desktop/files` or downloads latest `/download/desktop`.
  2. Server streams `.exe` files from `downloads/desktop`.

## Supported Board Families
- Arduino AVR: Uno, Nano, Nano old bootloader, Leonardo, Mega 2560, Sylvie, Uno aliases.
- ESP Arduino: ESP32, ESP8266 generic, ESP8266 NodeMCU.
- Nethub: ESP32 MicroPython `.py`/`.mpy` preparation.
- Raspberry Pi Pico: RP2040 Arduino CLI compile to `.uf2`.
- Micro:bit: v1/v2 PlatformIO compile to `.hex`.
- Kendryte K210/Maix: generic, MaixDock, Maixduino PlatformIO compile to `.bin`.

## Features
- Express API with CORS, Helmet, JSON body parsing, request logging, health check, and compile rate limiting.
- Board-to-toolchain routing through JSON config.
- Firmware catalog and binary firmware streaming.
- Nethub CP2102/CH340 driver and upload guidance.
- Runtime library listing, validation, and streaming for MicroPython clients.

## Out of Scope / Not Present
- Frontend UI: not in this repo.
- Database and persistent entities: none found.
- Authentication/authorization: no auth middleware found.
- Background queues/workers/schedulers: none found.
- Automated tests: none found.

## Needs Verification
- Exact production reverse-proxy config for `/stemblock` URL prefix.
- Installed production versions and locations of `arduino-cli`, PlatformIO, and `mpy-cross`.
- Whether client callers depend on legacy response values such as `type: "avr"` for non-AVR compilers.
