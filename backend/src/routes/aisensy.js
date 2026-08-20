const express = require("express");
const aiSensyService = require("../services/aiSensyService");

const router = express.Router();

function extractParams(req) {
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
  return { ...req.query, ...bodyObj };
}

/**
 * Endpoint for AiSensy WhatsApp Bot to fetch car service plans
 */
async function handleServicePlans(req, res) {
  try {
    const params = extractParams(req);
    console.log("📥 AiSensy Service Plans Request Params:", JSON.stringify(params));
    const result = await aiSensyService.getServicePlans(params);
    res.json(result);
  } catch (err) {
    console.error("Error in AiSensy service-plans endpoint:", err.message);
    res.status(500).json({
      whatsapp_text:
        "⚠️ Sorry, an error occurred while fetching service plans. Please try again later.",
      data: {
        whatsapp_text:
          "⚠️ Sorry, an error occurred while fetching service plans. Please try again later.",
      },
    });
  }
}

/**
 * Endpoint for AiSensy WhatsApp Bot to fetch top 3 nearest garages
 */
async function handleNearestGarages(req, res) {
  try {
    const params = extractParams(req);
    console.log("📥 AiSensy Nearest Garages Request Params:", JSON.stringify(params));
    const result = await aiSensyService.getNearestGarages(params);
    res.json(result);
  } catch (err) {
    console.error("Error in AiSensy nearest-garages endpoint:", err.message);
    res.status(500).json({
      whatsapp_text:
        "⚠️ Sorry, an error occurred while calculating nearest garages. Our team will contact you shortly.",
      data: {
        whatsapp_text:
          "⚠️ Sorry, an error occurred while calculating nearest garages. Our team will contact you shortly.",
      },
    });
  }
}

router.get("/service-plans", handleServicePlans);
router.post("/service-plans", handleServicePlans);

router.get("/nearest-garages", handleNearestGarages);
router.post("/nearest-garages", handleNearestGarages);
router.get("/garages", handleNearestGarages);
router.post("/garages", handleNearestGarages);

// Direct root routes for convenience if AiSensy points directly to /api/aisensy
router.get("/", handleServicePlans);
router.post("/", handleServicePlans);

module.exports = router;
