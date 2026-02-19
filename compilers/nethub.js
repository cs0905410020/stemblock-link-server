const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const MPY_CROSS = "/var/www/html/stemblock-link/toolchains/micropython/mpy-cross/build/mpy-cross";

/**
 * Compile MicroPython for NetHub ESP32
 */
function compileNetHub({ code, jobDir }) {

    return new Promise((resolve, reject) => {

        const srcDir = path.join(jobDir, "fs");
        fs.mkdirSync(srcDir, { recursive: true });

        // main.py (user program)
        const pyFile = path.join(srcDir, "main.py");
        fs.writeFileSync(pyFile, code);

        const mpyFile = path.join(srcDir, "main.mpy");

        const cmd = `${MPY_CROSS} ${pyFile} -o ${mpyFile}`;

        exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {

            if (err) {
                return reject(stderr || err.message);
            }

            if (!fs.existsSync(mpyFile)) {
                return reject("MPY generation failed");
            }

            resolve({
                message: "NetHub MicroPython compiled",
                files: {
                    py: pyFile,
                    mpy: mpyFile
                },
                stdout
            });
        });
    });
}

module.exports = { compileNetHub };
