const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

/**
 * Compile Kendryte K210 (MaixDock / Maixduino)
 * Toolchain: PlatformIO
 * Output: .bin
 */
function compileMaix({ code, variant, jobDir }) {
    return new Promise((resolve, reject) => {
        const projectDir = path.join(jobDir, "maix");
        fs.mkdirSync(projectDir, { recursive: true });

        // Map variants to PlatformIO boards
        const boardMap = {
            generic: "sipeed-maix-bit",
            maixdock: "sipeed-maix-dock",
            maixduino: "sipeed-maixduino"
        };

        const board = boardMap[variant];
        if (!board) {
            return reject(`Unsupported K210 variant: ${variant}`);
        }

        // platformio.ini
        const platformioIni = `
[env:k210]
platform = kendryte210
board = ${board}
framework = arduino
monitor_speed = 115200
`;

        fs.writeFileSync(
            path.join(projectDir, "platformio.ini"),
            platformioIni
        );

        // src/main.cpp
        const srcDir = path.join(projectDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        fs.writeFileSync(
            path.join(srcDir, "main.cpp"),
            code
        );

        const cmd = `pio run`;

        exec(
            cmd,
            {
                cwd: projectDir,
                timeout: 300000, // K210 builds are slow
                maxBuffer: 1024 * 1024 * 20
            },
            (err, stdout, stderr) => {
                if (err) {
                    return reject(stderr || err.message);
                }

                const buildDir = path.join(
                    projectDir,
                    ".pio/build/k210"
                );

                if (!fs.existsSync(buildDir)) {
                    return reject("K210 build directory not found");
                }

                const files = fs.readdirSync(buildDir);
                const binFile = files.find(f => f.endsWith(".bin"));

                if (!binFile) {
                    return reject("K210 firmware (.bin) not generated");
                }

                resolve({
                    message: "K210 compilation successful",
                    firmware: path.join(buildDir, binFile),
                    stdout
                });
            }
        );
    });
}

module.exports = {
    compileMaix
};
