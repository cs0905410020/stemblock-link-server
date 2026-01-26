const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

function compileArduino({ code, fqbn, jobDir }) {
    return new Promise((resolve, reject) => {
        const sketchDir = path.join(jobDir, "sketch");
        fs.mkdirSync(sketchDir, { recursive: true });

        const sketchFile = path.join(sketchDir, "sketch.ino");
        fs.writeFileSync(sketchFile, code);

        const cmd = `
      arduino-cli compile \
      --fqbn ${fqbn} \
      --output-dir ${jobDir}/build \
      ${sketchDir}
    `;

        exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
            if (error) {
                return reject(stderr || error.message);
            }

            resolve({
                message: "Compilation successful",
                stdout
            });
        });
    });
}

module.exports = {
    compileArduino
};
