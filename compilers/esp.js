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
 * Compile ESP32 / ESP8266 / NodeMCU using Arduino CLI
 */
function compileESP({ code, fqbn, jobDir }) {
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
                timeout: 180000, // ESP builds are slower
                maxBuffer: 1024 * 1024 * 10
            },
            (err, stdout, stderr) => {
                if (err) {
                    return reject(stderr || err.message);
                }

                // Find .bin firmware
                const files = fs.readdirSync(buildDir);
                const binFile = files.find(f => f.endsWith(".bin"));

                if (!binFile) {
                    return reject("ESP firmware (.bin) not generated");
                }

                resolve({
                    message: "ESP compilation successful",
                    firmware: path.join(buildDir, binFile),
                    stdout
                });
            }
        );
    });
}

module.exports = {
    compileESP
};
