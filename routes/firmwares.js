// routes/firmwares.js
const fs = require("fs");
const path = require("path");
const router = require("express").Router();

const BASE = path.join(__dirname, "../firmwares");

router.get("/", (req, res) => {
    const result = {};

    fs.readdirSync(BASE).forEach(category => {
        const dir = path.join(BASE, category);
        if (!fs.statSync(dir).isDirectory()) return;

        result[category] = fs.readdirSync(dir)
            .filter(f => f.endsWith(".hex") || f.endsWith(".bin") || f.endsWith(".uf2"));
    });

    res.json(result);
});
router.get("/:category/:filename", (req, res) => {
    const { category, filename } = req.params;

    const filePath = path.join(BASE, category, filename);

    // Security check (VERY important)
    if (!filePath.startsWith(BASE)) {
        return res.status(403).send("Access denied");
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Firmware not found");
    }

    // Important headers for WebSerial flashing
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Allow-Origin", "*");

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});
module.exports = router;
