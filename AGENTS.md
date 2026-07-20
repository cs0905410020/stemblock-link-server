# Stemblock Server Agent Memory

## Scope
- This repo is `stemblock-link-server`: a Node.js/Express compile and asset server for Stemblock hardware workflows.
- Primary areas: compiler API, board config, Arduino CLI/PlatformIO/mpy-cross compile flows, firmware downloads, runtime MicroPython libraries, Nethub upload metadata.
- No frontend, database, auth, queues, or workers are present in this repo.

## Read First
- `AGENTS.md`
- `docs/PROJECT_OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/FILE_MAP.md`
- `README.md`
- `package.json`
- `config/boards.json`

Use these docs as project memory. Scan source only when docs are unclear, stale, or a task needs verification.

## Important API Contracts
- `GET /health` returns service status and timestamp.
- `POST /compile` expects JSON `{ "board": string, "code": string }`.
- Compile responses expose `/stemblock/download/...` and `/stemblock/firmwares/...` paths, implying deployment behind a `/stemblock` reverse-proxy prefix.
- `GET /download/:jobId/:filename` serves generated artifacts from `temp/jobs/<jobId>`, then schedules cleanup.
- `GET /firmwares` and `GET /firmwares/:category/:filename` expose bundled firmware files.
- `GET /firmwares/nethub/manifest?chip=esp32` returns Nethub firmware candidates plus upload metadata.
- `GET /runtime-libs` and `GET /runtime-libs/:filename` expose MicroPython runtime library files.

## Change Rules
- Update docs when route names, API payloads, response shape, board support, compiler behavior, toolchain requirements, error format, runtime libs, firmware assets, or deployment assumptions change.
- Do not update docs for formatting-only or comment-only changes.
- Keep docs compact and factual. Mark uncertain items as `Needs verification`.

## Engineering Notes
- CommonJS modules; entrypoint is `server.js`.
- `config/boards.json` is the source of board IDs, compiler type, FQBN, variants, and output type.
- Compiler modules write temporary projects under `temp/jobs/<type><uuid>`.
- Arduino AVR and ESP compilers use hard-coded production paths under `/var/www/html/stemblock-link/...`; Pico uses repo-relative paths.
- Micro:bit and K210/Maix use `pio run`.
- Nethub compiles MicroPython `.py` to `.mpy` with `mpy-cross`, injects selected runtime libs, and returns upload guidance for WebSerial clients.
- There is no automated test suite configured. Prefer focused manual/API checks after changes.
