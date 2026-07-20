const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const boards = require("../config/boards.json");
const { compileArduino } = require("../compilers/arduino");
const { compileESP } = require("../compilers/esp");
const { compilePico } = require("../compilers/pico");
const { compileMicrobit } = require("../compilers/microbit");
const { compileMaix } = require("../compilers/maix");
const { compileNetHub } = require("../compilers/nethub");
const { getNethubUploadMetadata } = require("../lib/nethubSupport");


const router = express.Router();

function findFirstFileByExtension(dir, extension) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            const nestedFile = findFirstFileByExtension(fullPath, extension);
            if (nestedFile) return nestedFile;
        } else if (path.extname(entry.name).toLowerCase() === extension) {
            return fullPath;
        }
    }

    return null;
}

router.post("/", async (req, res) => {
    const { board, code } = req.body;

    if (!board || !code) {
        return res.status(400).json({
            error: "Missing board or code"
        });
    }

    const boardConfig = boards[board];

    if (!boardConfig) {
        return res.status(400).json({
            error: "Unsupported board"
        });
    }

    const jobId = boardConfig.type+uuidv4();
    const jobDir = path.join(__dirname, "../temp/jobs", jobId);
    const buildDir = path.join(jobDir, "build");
    let hexFilename, hexPath;
    try {
        fs.mkdirSync(jobDir, { recursive: true });

        let output;

        switch (boardConfig.type) {
            case "arduino":
            case "sylvie":
                output = await compileArduino({
                    code,
                    fqbn: boardConfig.fqbn,
                    jobDir
                });
                if (fs.existsSync(buildDir)) {
                    const hexFile = findFirstFileByExtension(buildDir, ".hex");
                    if (hexFile) {
                        const relativeHexFile = path.relative(buildDir, hexFile).replace(/\\/g, "/");
                        hexFilename = path.basename(hexFile);
                        hexPath = `/stemblock/download/${jobId}/${relativeHexFile}`;
                    }
                }
                if (!hexPath) {
                    throw new Error(`Arduino compile completed but no .hex output was produced for ${board}. Verify the board core and required Arduino libraries, including Servo.h for Sylvie servo sketches.`);
                }
                break;
            case "esp":
                output = await compileESP({
                    code,
                    fqbn: boardConfig.fqbn,
                    jobDir
                });

                const appFile        = path.basename(output.files.app);
                const bootloaderFile = path.basename(output.files.bootloader);
                const partitionsFile = path.basename(output.files.partitions);
                const flash_argsFile    = path.basename(output.files.flashArgs);

                return res.json({
                    status: "success",
                    jobId,
                    type: "esp",
                    files: {
                        app: `/stemblock/download/${jobId}/${appFile}`,
                        bootloader: `/stemblock/download/${jobId}/${bootloaderFile}`,
                        partitions: `/stemblock/download/${jobId}/${partitionsFile}`,
                        flashArgs: `/stemblock/download/${jobId}/${flash_argsFile}`
                    },
                    stdout: output.stdout || output.message
                });


            case "esp_mpy":
            case "nethub":
                output = await compileNetHub({
                    code,
                    jobDir
                });
                const pyFile  = path.basename(output.files.py);
                const mpyFile = path.basename(output.files.mpy);
                const runtimeFiles = (output.files.runtime || []).map(file => {
                    const relativeFile = path.relative(path.join(jobDir, "fs"), file).replace(/\\/g, "/");

                    return {
                        path: relativeFile,
                        target: `/${relativeFile}`,
                        url: `/stemblock/download/${jobId}/${relativeFile}`
                    };
                });

                return res.json({
                    status: "success",
                    jobId,
                    board: "nethub",
                    type: "nethub",
                    files: {
                        py: `/stemblock/download/${jobId}/${pyFile}`,
                        mpy: `/stemblock/download/${jobId}/${mpyFile}`,
                        runtime: runtimeFiles
                    },
                    runtimeFiles,
                    upload: output.upload || getNethubUploadMetadata(),
                    stdout: output.stdout || output.message
                });

            case "pico":
                output = await compilePico({
                    code,
                    fqbn: boardConfig.fqbn,
                    jobDir
                });
                break;
            case "microbit":
                output = await compileMicrobit({
                    code,
                    variant: boardConfig.variant,
                    jobDir
                });
                break;

            case "k210":
                output = await compileMaix({
                    code,
                    variant: boardConfig.variant,
                    jobDir
                });
                break;

            default:
                throw new Error("Unknown board type");
        }

        res.json({
            status: "success",
            jobId,
            type: "avr",
            hexPath,
            hexFilename,
            stdout: output.stdout || output.message
        });


    } catch (err) {
        console.error("Compile error:", err);
        res.status(500).json({
            status: "error",
            message: err.toString()
        });
    }
});

module.exports = router;
