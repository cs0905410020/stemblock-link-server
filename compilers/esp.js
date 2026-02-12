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
console.log(buildDir,'build');
                // expected firmware locations (ESP32 core 3.x)
                const mergedPath = path.join(buildDir, "sketch.ino.merged.bin");
                const firmwarePath = path.join(buildDir, "sketch.ino.bin");

                let flashImage = null;

                if (fs.existsSync(mergedPath)) {
                    flashImage = mergedPath;
                } else if (fs.existsSync(firmwarePath)) {
                    flashImage = firmwarePath;
                }

                if (!flashImage) {
                    console.log("Build directory contents:", fs.readdirSync(buildDir));
                    return reject("ESP32 firmware not generated");
                }

                resolve({
                    message: "ESP compilation successful",
                    files: {
                        flash: flashImage
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
