const fs = require("fs");
const path = require("path");

const RUNTIME_LIBS_DIR = process.env.RUNTIME_LIBS_DIR
    ? path.resolve(process.env.RUNTIME_LIBS_DIR)
    : path.resolve(__dirname, "../runtime-libs");

const NETHUB_BASE_RUNTIME_LIBS = Object.freeze([
    "BlynkLib.py",
    "lcd_api.py",
    "i2c_lcd.py",
    "neopixel.py",
    "servo.py",
    "ultrasonic.py"
]);

const NETHUB_OPTIONAL_RUNTIME_LIBS = Object.freeze({
    irRx: "ir_rx"
});

const NETHUB_RUNTIME_LIBS = Object.freeze([
    ...NETHUB_BASE_RUNTIME_LIBS,
    "ir_rx"
]);

function getNethubRuntimeLibsForCode(code = "") {
    const libs = [...NETHUB_BASE_RUNTIME_LIBS];
    const usesIrRx = /\bfrom\s+ir_rx(?:\.nec)?\s+import\b|\bimport\s+ir_rx(?:\.nec)?\b|\bNEC_8\b/.test(code);

    if (usesIrRx) {
        libs.push(NETHUB_OPTIONAL_RUNTIME_LIBS.irRx);
    }

    return libs;
}

const MICRO_PYTHON_COMPATIBILITY_RULES = Object.freeze({
    "i2c_lcd.py": {
        disallowedPatterns: [/\b(?:from|import)\s+smbus\b/],
        message: "must use the MicroPython I2C driver, not smbus"
    }
});

function getRuntimeLibPath(filename) {
    return path.join(RUNTIME_LIBS_DIR, filename);
}

function listRuntimeLibFiles() {
    const files = [];

    function walk(dir, relativeDir = "") {
        fs.readdirSync(dir, { withFileTypes: true })
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(entry => {
                const relativePath = path.join(relativeDir, entry.name);
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    walk(fullPath, relativePath);
                    return;
                }

                if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".py") {
                    files.push(relativePath.replace(/\\/g, "/"));
                }
            });
    }

    walk(RUNTIME_LIBS_DIR);
    return files;
}

function validateRuntimeLib(filename) {
    const filePath = getRuntimeLibPath(filename);
    const relativePath = path.relative(RUNTIME_LIBS_DIR, filePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(`Invalid runtime library path: ${filename}`);
    }

    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing runtime library: ${filename}`);
    }

    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
        return filePath;
    }

    if (!stats.isFile() || path.extname(filePath).toLowerCase() !== ".py") {
        throw new Error(`Invalid runtime library: ${filename}`);
    }

    const compatibilityRule = MICRO_PYTHON_COMPATIBILITY_RULES[filename];
    if (!compatibilityRule) {
        return filePath;
    }

    const fileContents = fs.readFileSync(filePath, "utf8");
    const hasIncompatibleImport = compatibilityRule.disallowedPatterns
        .some(pattern => pattern.test(fileContents));

    if (hasIncompatibleImport) {
        throw new Error(`Runtime library ${filename} ${compatibilityRule.message}`);
    }

    return filePath;
}

module.exports = {
    RUNTIME_LIBS_DIR,
    NETHUB_RUNTIME_LIBS,
    getNethubRuntimeLibsForCode,
    getRuntimeLibPath,
    listRuntimeLibFiles,
    validateRuntimeLib
};
