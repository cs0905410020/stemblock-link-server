const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const compileRoute = require("./routes/compile");

const app = express();
const PORT = process.env.PORT || 20111;

// Security & middleware
app.use(helmet());
app.use(cors());
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

// Compile API
app.use("/compile", compileRoute);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 stemblock-link-server running on port ${PORT}`);
});
