const express = require("express");
const aiSensyService = require("../services/aiSensyService");

const router = express.Router();

/**
 * Endpoint for AiSensy WhatsApp Bot to fetch car service plans
 * Supports both GET and POST requests
 */
async function handleServicePlans(req, res) {
  try {
    let bodyObj = {};
    if (typeof req.body === "object" && req.body !== null) {
      bodyObj = req.body;
    } else if (typeof req.body === "string" && req.body.trim()) {
      try {
        bodyObj = JSON.parse(req.body);
      } catch (e1) {
        try {
          const parsed = new URLSearchParams(req.body);
          for (const [k, v] of parsed.entries()) {
            bodyObj[k] = v;
          }
        } catch (e2) {
          bodyObj = { rawText: req.body };
        }
      }
    }
    const params = { ...req.query, ...bodyObj };
    console.log("📥 AiSensy Incoming Request Params:", JSON.stringify(params));
    const result = await aiSensyService.getServicePlans(params);
    res.json(result);
  } catch (err) {
    console.error("Error in AiSensy service-plans endpoint:", err.message);
    res.status(500).json({
      success: false,
      matched: false,
      detail: "Failed to process service plans request for WhatsApp bot",
      whatsapp_text:
        "⚠️ Sorry, an error occurred while fetching service plans. Please try again later.",
    });
  }
}

router.get("/service-plans", handleServicePlans);
router.post("/service-plans", handleServicePlans);

// Direct root routes for convenience if AiSensy points directly to /api/aisensy
router.get("/", handleServicePlans);
router.post("/", handleServicePlans);

module.exports = router;
