// routes/runtime-libs.js
const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const {
    RUNTIME_LIBS_DIR,
    listRuntimeLibFiles,
    validateRuntimeLib
} = require("../lib/runtimeLibs");

// where your libraries actually exist
const BASE = RUNTIME_LIBS_DIR;

/**
 * GET /runtime-libs
 * Returns list of available MicroPython runtime libraries
 */
router.get("/", (req, res) => {
    try {
        const files = listRuntimeLibFiles().filter(file => {
            try {
                validateRuntimeLib(file);
                return true;
            } catch (error) {
                console.error(`Skipping incompatible runtime library ${file}:`, error.message);
                return false;
            }
        });

        res.json({
            files
        });
    } catch (e) {
        res.status(500).json({ error: "Unable to read runtime libraries" });
    }
});


/**
 * GET /runtime-libs/:filename
 * Download a specific library file
 */
router.get("/:filename", (req, res) => {
    const { filename } = req.params;

    // allow only safe filenames
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return res.status(400).send("Invalid filename");
    }

    let filePath;

    try {
        filePath = validateRuntimeLib(filename);
    } catch (error) {
        return res.status(500).send(error.message);
    }

    const relativePath = path.relative(BASE, filePath);

    // SECURITY: prevent path traversal
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        return res.status(403).send("Access denied");
    }

    // VERY IMPORTANT for WebSerial + fetch()
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});

module.exports = router;
