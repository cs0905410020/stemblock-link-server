const fs = require("fs");
const path = require("path");

const RUNTIME_LIBS_DIR = process.env.RUNTIME_LIBS_DIR
    ? path.resolve(process.env.RUNTIME_LIBS_DIR)
    : path.resolve(__dirname, "../runtime-libs");

const NETHUB_RUNTIME_LIBS = Object.freeze([
    "BlynkLib.py",
    "lcd_api.py",
    "i2c_lcd.py",
    "neopixel.py",
    "servo.py",
    "ultrasonic.py"
]);

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
    return fs.readdirSync(RUNTIME_LIBS_DIR)
        .filter(file => path.extname(file).toLowerCase() === ".py");
}

function validateRuntimeLib(filename) {
    const filePath = getRuntimeLibPath(filename);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing runtime library: ${filename}`);
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
    getRuntimeLibPath,
    listRuntimeLibFiles,
    validateRuntimeLib
};
