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


const router = express.Router();

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

    const jobId = uuidv4();
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
                    const files = fs.readdirSync(buildDir);
                    const hexFile = files.find(f => f.endsWith('.hex'));
                    if (hexFile) {
                        hexFilename = hexFile;  // e.g. "sketch.ino.hex"
                        hexPath = `/stemblock/download/${jobId}/${hexFile}`;
                    }
                }
                break;
            case "esp":
                output = await compileESP({
                    code,
                    fqbn: boardConfig.fqbn,
                    jobDir
                });
                break;
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
            hexPath,           // 👈 NEW: /stemblock/download/{jobId}/sketch.ino.hex
            hexFilename,       // 👈 NEW: exact filename
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
