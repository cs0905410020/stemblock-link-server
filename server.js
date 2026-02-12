const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const compileRoute = require("./routes/compile");
const downloadRoute = require("./routes/download");
const firmwareRoute = require("./routes/firmwares");

const app = express();
const PORT = process.env.PORT || 20111;

// Security & middleware
app.use(helmet());

app.use(cors({
    origin: [
        "https://stemblock.in",
        "https://www.stemblock.in",
        "https://stemblock.co.in",
        "https://www.stemblock.co.in",
        "https://stemblock.app",
        "https://www.stemblock.app",
        "http://127.0.0.1:8601",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors()); // 👈 THIS LINE FIXES PREFLIGHT

app.use(express.json({ limit: "5mb" }));
app.use(morgan("combined"));

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "stemblock-link-server",
        time: new Date().toISOString()
    });
});
app.set("trust proxy", 1);
const rateLimit = require("express-rate-limit");

const compileLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use("/compile", compileLimiter);

// Compile API
app.use("/compile", compileRoute);
app.use("/download", downloadRoute);
app.use("/firmwares", firmwareRoute);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 stemblock-link-server running on port ${PORT}`);
});
