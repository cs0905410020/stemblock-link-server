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

function compileArduino({ code, fqbn, jobDir }) {
    return new Promise((resolve, reject) => {
        const sketchDir = path.join(jobDir, "sketch");
        require("fs").mkdirSync(sketchDir, { recursive: true });

        const sketchFile = path.join(sketchDir, "sketch.ino");
        require("fs").writeFileSync(sketchFile, code);

        const cmd = `
      ${ARDUINO_CLI} compile
      --config-file ${ARDUINO_CONFIG}
      --fqbn ${fqbn}
      --output-dir ${jobDir}/build
      ${sketchDir}
    `;

        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) return reject(stderr || err.message);
            resolve({ stdout });
        });
    });
}

module.exports = { compileArduino };
