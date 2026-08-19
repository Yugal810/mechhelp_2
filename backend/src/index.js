const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { FRONTEND_DIST, PORT } = require("./config");
const carsRouter = require("./routes/cars");
const garagesRouter = require("./routes/garages");
const aisensyRouter = require("./routes/aisensy");

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

const connectDB = require("./db");
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Database connection error in middleware:", err.message);
    res.status(500).json({ detail: "Database connection failure" });
  }
});

app.use("/api/cars", carsRouter);
app.use("/cars", carsRouter);
app.use("/api/garages", garagesRouter);
app.use("/garages", garagesRouter);
app.use("/api/aisensy", aisensyRouter);
app.use("/aisensy", aisensyRouter);

app.get("/api", (_req, res) => {
  res.json({
    status: "online",
    message: "MechHelp API Microservice is running",
    endpoints: {
      cars: "/api/cars",
      garages: "/api/garages",
      aisensy: "/api/aisensy/service-plans",
    },
  });
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res
      .status(503)
      .send(
        "Frontend not built yet. Run `npm run build` or start Vite with `npm run dev:frontend`."
      );
  });
}

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`MechHelp API running at http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Stop the other process or set PORT=...`
      );
      process.exit(1);
    }
    throw err;
  });
}

module.exports = app;
