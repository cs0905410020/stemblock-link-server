const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const ARDUINO_CLI = "/var/www/html/stemblock-link/toolchains/arduino-cli/arduino-cli";
const ARDUINO_CONFIG = "/var/www/html/stemblock-link/toolchains/arduino-cli/arduino-cli.yaml";


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

        const cmd = `${ARDUINO_CLI} compile --config-file ${ARDUINO_CONFIG} --fqbn ${fqbn} --build-path ${buildDir} --export-binaries --warnings none ${sketchDir}`;

        exec(
            cmd,
            {
                timeout: 180000, // ESP builds are slower
                maxBuffer: 1024 * 1024 * 10
            },
            (err, stdout, stderr) => {
                console.log(err);
                if (err) {
                    return reject(stderr || err.message);
                }
                const files = fs.readdirSync(buildDir);

                const app        = files.find(f => f.endsWith(".ino.bin"));
                const bootloader = files.find(f => f.includes("bootloader.bin"));
                const partitions = files.find(f => f.includes("partitions.bin"));

                const flashArgsPath = path.join(buildDir, "flash_args");

                if (!app || !bootloader || !partitions || !fs.existsSync(flashArgsPath)) {
                    return reject("ESP32 flash files missing");
                }

                resolve({
                    message: "ESP compilation successful",
                    files: {
                        app: path.join(buildDir, app),
                        bootloader: path.join(buildDir, bootloader),
                        partitions: path.join(buildDir, partitions),
                        flashArgs: flashArgsPath
                    },
                    stdout
                });

            }
        );
    });
}

module.exports = {
    compileESP
};
