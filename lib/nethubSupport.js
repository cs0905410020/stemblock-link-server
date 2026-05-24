const path = require("path");

const NETHUB_BOARD_ID = "nethub";
const NETHUB_CHIP = "esp32";
const NETHUB_FIRMWARE_CATEGORY = "microPython";

const NETHUB_USB_SERIAL_ADAPTERS = Object.freeze([
    {
        name: "Silicon Labs CP210x (CP2102)",
        driver: "cp210x",
        pnpId: "USB\\VID_10C4&PID_EA60",
        usbVendorId: 0x10C4,
        usbProductId: 0xEA60,
        priority: 1
    },
    {
        name: "WCH CH340 / CH341",
        driver: "ch34x",
        pnpId: "USB\\VID_1A86&PID_7523",
        usbVendorId: 0x1A86,
        usbProductId: 0x7523,
        priority: 2
    }
]);

const NETHUB_UPLOAD_OPTIONS = Object.freeze({
    board: "ESP32",
    connection: "USB serial",
    baudRate: 115200,
    replBaudRate: 115200,
    serialAdapters: NETHUB_USB_SERIAL_ADAPTERS,
    resetStrategies: [
        "default_reset",
        "classic_dtr_rts",
        "inverted_dtr_rts",
        "manual_boot"
    ],
    retry: {
        bootloaderSyncAttempts: 3,
        replSyncAttempts: 6,
        portReopenDelayMs: 1500
    },
    messages: {
        driverMissing: "Install the Silicon Labs CP210x VCP driver, reconnect the Nethub board, then refresh the serial-port list.",
        portBusy: "Close any serial monitor or terminal using the Nethub port, then retry upload.",
        bootMode: "If bootloader sync fails, press and hold BOOT while upload starts, then release after flashing begins.",
        replSync: "Reset or reconnect the board if MicroPython REPL does not appear after firmware flashing."
    }
});

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getNethubUploadMetadata() {
    return clone(NETHUB_UPLOAD_OPTIONS);
}

function classifyFirmware(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes("esp8266")) return "esp8266";
    if (lower.includes("esp32")) return "esp32";
    if (lower.includes("esp")) return "esp";
    return "unknown";
}

function firmwarePriority(filename, chip) {
    const lower = filename.toLowerCase();
    if (chip === "esp32" && lower.includes("esp32")) return 0;
    if (chip === "esp8266" && lower.includes("esp8266")) return 0;
    if (chip === "esp32" && lower === "micropython-esp.bin") return 1;
    if (lower.includes(chip)) return 1;
    return 9;
}

function getNethubFirmwareManifest(files, chip = NETHUB_CHIP) {
    const normalizedChip = String(chip || NETHUB_CHIP).toLowerCase();
    const firmware = files
        .filter(file => path.extname(file).toLowerCase() === ".bin")
        .map(file => ({
            filename: file,
            chip: classifyFirmware(file),
            url: `/stemblock/firmwares/${NETHUB_FIRMWARE_CATEGORY}/${file}`,
            priority: firmwarePriority(file, normalizedChip)
        }))
        .filter(file => file.priority < 9)
        .sort((a, b) => a.priority - b.priority || a.filename.localeCompare(b.filename))
        .map((file, index) => ({
            filename: file.filename,
            chip: file.chip,
            url: file.url,
            recommended: index === 0
        }));

    return {
        board: NETHUB_BOARD_ID,
        chip: normalizedChip,
        firmware,
        upload: getNethubUploadMetadata()
    };
}

module.exports = {
    NETHUB_BOARD_ID,
    NETHUB_CHIP,
    NETHUB_FIRMWARE_CATEGORY,
    NETHUB_USB_SERIAL_ADAPTERS,
    getNethubFirmwareManifest,
    getNethubUploadMetadata
};
