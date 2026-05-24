# Nethub CP2102 Driver Setup

## Metadata

- Last Updated: 2026-05-05
- Updated By: Codex Agent
- Change Summary: Added Nethub CP2102 driver and upload contract notes

## Scope

- Applies to Nethub ESP32 boards connected through USB serial.
- Supported serial adapters are Silicon Labs CP210x / CP2102 (`USB\VID_10C4&PID_EA60`) and CH340 / CH341 (`USB\VID_1A86&PID_7523`).
- `POST /compile` for board `nethub` returns an `upload` object with serial adapter IDs, reset strategies, retry counts, and user-facing recovery messages.
- `GET /firmwares/nethub/manifest?chip=esp32` returns ordered Nethub MicroPython firmware candidates plus the same upload metadata.

## Driver Setup

1. Install the Silicon Labs CP210x VCP driver from `https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers`.
2. Reconnect the Nethub board after installation.
3. Refresh the serial-port list and select the Nethub CP210x / CP2102 port.
4. Close other serial monitors before upload.

## Troubleshooting

- No port listed: install or reinstall the CP210x driver, reconnect the board, and refresh.
- Port busy or access denied: close serial terminals, IDE monitors, and other applications using the COM/tty device.
- Bootloader sync fails: press and hold BOOT while upload starts, then release after flashing begins.
- REPL sync fails after reset: reconnect or press reset, wait for the port to reappear, then retry upload.
- Multiple serial devices: select the CP210x / CP2102 Nethub port instead of another USB serial device.

## Manual Verification

- Connect a CP2102-based Nethub ESP32 board and confirm the port is listed.
- Compile and upload a Nethub program repeatedly.
- Flash firmware, then verify MicroPython REPL sync after reset.
- Repeat with a CH340-based ESP32 board to check non-CP2102 regression risk.
