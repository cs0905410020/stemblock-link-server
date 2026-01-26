const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const ARDUINO_CLI = path.join(
    __dirname,
    "../toolchains/arduino-cli/arduino-cli"
);

const ARDUINO_CONFIG = path.join(
    __dirname,
    "../toolchains/arduino-cli/arduino-cli.yaml"
);

/**
 * Compile Raspberry Pi Pico (RP2040)
 * Output: .uf2
 */
function compilePico({ code, fqbn, jobDir }) {
    return new Promise((resolve, reject) => {
        const sketchDir = path.join(jobDir, "sketch");
        fs.mkdirSync(sketchDir, { recursive: true });

        const sketchFile = path.join(sketchDir, "sketch.ino");
        fs.writeFileSync(sketchFile, code);

        const buildDir = path.join(jobDir, "build");

        const cmd = `
      ${ARDUINO_CLI} compile
      --config-file ${ARDUINO_CONFIG}
      --fqbn ${fqbn}
      --output-dir ${buildDir}
      ${sketchDir}
    `;

        exec(
            cmd,
            {
                timeout: 180000,
                maxBuffer: 1024 * 1024 * 10
            },
            (err, stdout, stderr) => {
                if (err) {
                    return reject(stderr || err.message);
                }

                // Look for UF2 firmware
                const files = fs.readdirSync(buildDir);
                const uf2File = files.find(f => f.endsWith(".uf2"));

                if (!uf2File) {
                    return reject("Pico firmware (.uf2) not generated");
                }

                resolve({
                    message: "Raspberry Pi Pico compilation successful",
                    firmware: path.join(buildDir, uf2File),
                    stdout
                });
            }
        );
    });
}

module.exports = {
    compilePico
};
