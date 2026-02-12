const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

/**
 * Compile Micro:bit (v1 / v2) using PlatformIO
 * Output: .hex
 */
function compileMicrobit({ code, variant, jobDir }) {
    return new Promise((resolve, reject) => {
        const projectDir = path.join(jobDir, "microbit");
        fs.mkdirSync(projectDir, { recursive: true });

        // platformio.ini
        const platformioIni = `
[env:microbit]
platform = nordicnrf51
board = ${variant === "v2" ? "bbcmicrobit_v2" : "bbcmicrobit"}
framework = arduino
build_flags =
  -DARDUINO_ARCH_NRF5
`;

        fs.writeFileSync(
            path.join(projectDir, "platformio.ini"),
            platformioIni
        );

        // src/main.cpp
        const srcDir = path.join(projectDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const cppFile = path.join(srcDir, "main.cpp");
        fs.writeFileSync(cppFile, code);

        const cmd = `pio run`;

        exec(
            cmd,
            {
                cwd: projectDir,
                timeout: 180000,
                maxBuffer: 1024 * 1024 * 10
            },
            (err, stdout, stderr) => {
                if (err) {
                    return reject(stderr || err.message);
                }

                const buildDir = path.join(
                    projectDir,
                    ".pio/build/microbit"
                );

                const files = fs.readdirSync(buildDir);
                const hexFile = files.find(f => f.endsWith(".hex"));

                if (!hexFile) {
                    return reject("Micro:bit firmware (.hex) not generated");
                }

                resolve({
                    message: "Micro:bit compilation successful",
                    firmware: path.join(buildDir, hexFile),
                    stdout
                });
            }
        );
    });
}

module.exports = {
    compileMicrobit
};
