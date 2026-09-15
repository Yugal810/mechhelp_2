const express = require("express");
const referralService = require("../services/referralService");

const router = express.Router();

function extractReqParams(req) {
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
        bodyObj = { text: req.body, code: req.body };
      }
    }
  }
  return { ...req.query, ...bodyObj };
}

/**
 * Register a completed service and create vehicle plate referral code
 * Body: { vehiclePlateNumber, referrerPhone, referrerName, vehicleModel, discountValue, usageLimit }
 */
router.post("/register", async (req, res) => {
  try {
    const params = extractReqParams(req);
    const {
      vehiclePlateNumber,
      referrerPhone,
      referrerName,
      vehicleModel,
      discountValue,
      usageLimit,
    } = params;

    if (!vehiclePlateNumber || !referrerPhone) {
      return res.status(400).json({
        success: false,
        error: "vehiclePlateNumber and referrerPhone are required.",
      });
    }

    const result = await referralService.registerReferral({
      vehiclePlateNumber,
      referrerPhone,
      referrerName,
      vehicleModel,
      discountValue,
      usageLimit,
    });

    res.json(result);
  } catch (err) {
    console.error("Error registering referral code:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Validate a referral code (vehicle plate number)
 * Query/Body: code or referralCode or vname or query or text, refereePhone or phone or customerPhone or wa_number
 */
router.all("/validate", async (req, res) => {
  try {
    const params = extractReqParams(req);
    const code =
      params.code ||
      params.referralCode ||
      params.referral_code ||
      params.vname ||
      params.query ||
      params.text ||
      params.rawText;

    const refereePhone =
      params.refereePhone ||
      params.phone ||
      params.customerPhone ||
      params.customer_phone ||
      params.wa_number ||
      "";

    if (!code) {
      return res.json({
        valid: false,
        discountValue: 0,
        reason: "referralCode is required.",
        message: "Please enter a referral code.",
      });
    }

    const validation = await referralService.validateReferralCode(code, refereePhone);
    res.json(validation);
  } catch (err) {
    console.error("Error validating referral code:", err.message);
    res.json({
      valid: false,
      discountValue: 0,
      error: err.message,
      message: "Error validating referral code.",
    });
  }
});

/**
 * Trigger feedback and referral template data payload for AiSensy
 * Body: { vehiclePlateNumber, customerPhone, customerName, vehicleModel }
 */
router.post("/trigger-feedback", async (req, res) => {
  try {
    const params = extractReqParams(req);
    const { vehiclePlateNumber, customerPhone, customerName, vehicleModel } = params;

    if (!vehiclePlateNumber || !customerPhone) {
      return res.status(400).json({
        success: false,
        error: "vehiclePlateNumber and customerPhone are required.",
      });
    }

    const referralData = await referralService.registerReferral({
      vehiclePlateNumber,
      referrerPhone: customerPhone,
      referrerName: customerName,
      vehicleModel,
    });

    const whatsappFeedbackText = [
      `Hi *${customerName || "Valued Customer"}*, thank you for servicing your *${vehicleModel || "vehicle"} (${referralData.vehiclePlateNumber})* with MECHHELP! 🚗`,
      ``,
      `How was your service experience? Please tap below to rate us:`,
      `⭐ https://mechhelp-2.vercel.app/feedback`,
      ``,
      `🎁 *Give ₹${referralData.discountValue}, Get ₹${referralData.discountValue}!*`,
      `Share your car's plate number *${referralData.vehiclePlateNumber}* as a referral code with your friends on WhatsApp!`,
      `When they use code *${referralData.vehiclePlateNumber}*, they get *₹${referralData.discountValue} OFF* their first car service.`,
      ``,
      `📲 Click link to share on WhatsApp:`,
      `${referralData.shareLink}`,
    ].join("\n");

    res.json({
      success: true,
      referralCode: referralData.referralCode,
      vehiclePlateNumber: referralData.vehiclePlateNumber,
      whatsapp_text: whatsappFeedbackText,
      share_link: referralData.shareLink,
      share_message: referralData.shareMessage,
    });
  } catch (err) {
    console.error("Error triggering feedback referral:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
