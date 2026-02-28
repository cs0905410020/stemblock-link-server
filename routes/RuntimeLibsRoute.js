// routes/runtime-libs.js
const fs = require("fs");
const path = require("path");
const router = require("express").Router();

// where your libraries actually exist
const BASE = path.join(__dirname, "../runtime-libs");

/**
 * GET /runtime-libs
 * Returns list of available MicroPython runtime libraries
 */
router.get("/", (req, res) => {
    try {
        const files = fs.readdirSync(BASE)
            .filter(f => f.endsWith(".py"));   // IMPORTANT: only .py

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

    const filePath = path.join(BASE, filename);

    // SECURITY: prevent path traversal
    if (!filePath.startsWith(BASE)) {
        return res.status(403).send("Access denied");
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Library not found");
    }

    // VERY IMPORTANT for WebSerial + fetch()
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});

module.exports = router;