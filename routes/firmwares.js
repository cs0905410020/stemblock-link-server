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

module.exports = router;
