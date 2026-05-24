const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const {
    NETHUB_RUNTIME_LIBS,
    validateRuntimeLib
} = require("../lib/runtimeLibs");
const { getNethubUploadMetadata } = require("../lib/nethubSupport");

const MPY_CROSS = process.env.MPY_CROSS
    ? path.resolve(process.env.MPY_CROSS)
    : path.resolve(__dirname, "../toolchains/micropython/mpy-cross/build/mpy-cross");

function injectRuntimeLibraries(srcDir, callback) {

    const libs = NETHUB_RUNTIME_LIBS;

    try {

        // Copy first
        libs.forEach(lib => {
            const src = validateRuntimeLib(lib);
            const dest = path.join(srcDir, lib);
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
        if (!fs.existsSync(MPY_CROSS)) {
            return reject(`mpy-cross not found at ${MPY_CROSS}`);
        }

        const srcDir = path.join(jobDir, "fs");
        fs.mkdirSync(srcDir, { recursive: true });

        // main.py (user program)
        const pyFile = path.join(srcDir, "main.py");
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
                    upload: getNethubUploadMetadata(),
                    stdout
                });
            });

        });
    });
}

module.exports = { compileNetHub };
