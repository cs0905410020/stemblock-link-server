const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ARDUINO_CLI = "/var/www/html/stemblock-link/toolchains/arduino-cli/arduino-cli";
const ARDUINO_CONFIG = "/var/www/html/stemblock-link/toolchains/arduino-cli/arduino-cli.yaml";

function compileArduino({ code, fqbn, jobDir }) {
    return new Promise((resolve, reject) => {
        const sketchName = "sketch";
        const sketchDir = path.join(jobDir, sketchName);
        fs.mkdirSync(sketchDir, { recursive: true });

        const sketchFile = path.join(sketchDir, `${sketchName}.ino`);
        fs.writeFileSync(sketchFile, code);

        const buildDir = path.join(jobDir, "build");


        const args = [
            "compile",
            "--config-file",
            ARDUINO_CONFIG,
            "--fqbn",
            fqbn,
            "--output-dir",
            buildDir,
            sketchDir
        ];

        execFile(
            ARDUINO_CLI,
            args,
            {
                timeout: 120000,
                cwd: "/var/www/html/stemblock-link/toolchains/arduino-cli"
            },
            (error, stdout, stderr) => {
                if (error) {
                    return reject(stderr || error.message);
                }

                resolve({
                    message: "Compilation successful",
                    stdout
                });
            }
        );

    });
}

module.exports = { compileArduino };
