const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const boards = require("../config/boards.json");
const { compileArduino } = require("../compilers/arduino");

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

    try {
        fs.mkdirSync(jobDir, { recursive: true });

        let output;

        switch (boardConfig.type) {
            case "arduino":
                output = await compileArduino({
                    code,
                    fqbn: boardConfig.fqbn,
                    jobDir
                });
                break;

            default:
                return res.status(400).json({
                    error: "Board type not implemented yet"
                });
        }

        res.json({
            status: "success",
            jobId,
            output
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
