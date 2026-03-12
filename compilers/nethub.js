const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const MPY_CROSS = "/var/www/html/stemblock-link/toolchains/micropython/mpy-cross/build/mpy-cross";
const RUNTIME_LIBS = "/var/www/html/stemblock-link/runtime-libs";

function injectRuntimeLibraries(srcDir, callback) {

    const libs = ["BlynkLib.py", "lcd_api.py", "i2c_lcd.py", "neopixel.py", "servo.py", "ultrasonic.py"];

    try {

        // Copy first
        libs.forEach(lib => {
            const src = path.join(RUNTIME_LIBS, lib);
            console.log(src,'src');
            const dest = path.join(srcDir, lib);
            console.log(dest,'dest');
            if (!fs.existsSync(src)) {
                throw new Error(`Missing runtime library: ${lib}`);
            }
            console.log(lib,'src');
            fs.copyFileSync(src, dest);
        });

        // Compile sequentially (VERY IMPORTANT)
        function compileNext(index) {

            if (index >= libs.length) {
                return callback(null);
            }

            const lib = libs[index];
            const py = path.join(srcDir, lib);
            const mpy = py.replace(".py", ".mpy");

            const cmd = `"${MPY_CROSS}" "${py}" -o "${mpy}"`;

            exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {

                if (err || !fs.existsSync(mpy)) {
                    return callback(`Failed compiling ${lib}: ${stderr || err.message}`);
                }

                compileNext(index + 1);
            });
        }

        compileNext(0);

    } catch (e) {
        callback(e.message);
    }
}
function compileNetHub({ code, jobDir }) {

    return new Promise((resolve, reject) => {

        const srcDir = path.join(jobDir, "fs");
        fs.mkdirSync(srcDir, { recursive: true });

        // main.py (user program)
        const pyFile = path.join(srcDir, "main.py");
        console.log(pyFile,'pyFile');
        fs.writeFileSync(pyFile, code);

        // 2. inject + compile libraries FIRST
        injectRuntimeLibraries(srcDir, (libErr) => {

            if (libErr) {
                return reject(libErr);
            }

            // 3. compile main LAST
            const mpyFile = path.join(srcDir, "main.mpy");

            const cmd = `"${MPY_CROSS}" "${pyFile}" -o "${mpyFile}"`;

        exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {

            if (err) {
                return reject(stderr || err.message);
            }

            if (!fs.existsSync(mpyFile)) {
                return reject("MPY generation failed");
            }

                // DO NOT TOUCH (your original resolve format)
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
    });
}

module.exports = { compileNetHub };
