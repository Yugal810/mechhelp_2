const express = require("express");
const referralService = require("../services/referralService");

const router = express.Router();

/**
 * Register a completed service and create vehicle plate referral code
 * Body: { vehiclePlateNumber, referrerPhone, referrerName, vehicleModel, discountValue, usageLimit }
 */
router.post("/register", async (req, res) => {
  try {
    const {
      vehiclePlateNumber,
      referrerPhone,
      referrerName,
      vehicleModel,
      discountValue,
      usageLimit,
    } = req.body;

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
    const code =
      req.query.code ||
      req.query.referralCode ||
      req.query.referral_code ||
      req.query.vname ||
      req.query.query ||
      req.query.text ||
      req.body.code ||
      req.body.referralCode ||
      req.body.referral_code ||
      req.body.vname ||
      req.body.query ||
      req.body.text;

    const refereePhone =
      req.query.refereePhone ||
      req.query.phone ||
      req.query.customerPhone ||
      req.query.customer_phone ||
      req.query.wa_number ||
      req.body.refereePhone ||
      req.body.phone ||
      req.body.customerPhone ||
      req.body.customer_phone ||
      req.body.wa_number ||
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
    const { vehiclePlateNumber, customerPhone, customerName, vehicleModel } = req.body;

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
