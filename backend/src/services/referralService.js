const Referral = require("../models/Referral");
const ReferralRedemption = require("../models/ReferralRedemption");

class ReferralService {
  /**
   * Normalize vehicle plate string into standard uppercase alphanumeric code.
   * e.g. "MH-31 AB 1234" -> "MH31AB1234"
   */
  normalizePlate(rawStr = "") {
    const cleaned = String(rawStr || "").replace(/[\{\}\$]/g, "").trim();
    if (!cleaned) return "";
    const extracted = this.extractPlateNumber(cleaned);
    if (extracted) return extracted;
    return String(cleaned)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();
  }

  /**
   * Extract potential Indian vehicle plate number from arbitrary text string using regex pattern.
   * e.g. "{Hi MECHHELP, I want to book a car service using referral code MH31AB1234}" -> "MH31AB1234"
   */
  extractPlateNumber(text = "") {
    if (!text) return null;
    const cleanText = String(text).replace(/[\{\}\$]/g, "").trim();
    const plateRegex = /\b([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{4})\b/i;
    const match = cleanText.match(plateRegex);
    return match ? match[1].toUpperCase().replace(/[^A-Z0-9]/g, "").trim() : null;
  }

  /**
   * Register or update a referral code based on customer vehicle plate number upon service completion.
   */
  async registerReferral({
    vehiclePlateNumber,
    referrerPhone,
    referrerName = "Valued Customer",
    vehicleModel = "",
    discountValue = 200,
    usageLimit = 5,
  }) {
    const cleanPlate = this.normalizePlate(vehiclePlateNumber);
    if (!cleanPlate) {
      throw new Error("Invalid vehicle plate number provided.");
    }
    const cleanPhone = String(referrerPhone || "").replace(/[^0-9]/g, "").trim();
    if (!cleanPhone) {
      throw new Error("Invalid referrer phone number provided.");
    }

    const referral = await Referral.findOneAndUpdate(
      { referralCode: cleanPlate },
      {
        referralCode: cleanPlate,
        vehiclePlateNumber: cleanPlate,
        referrerPhone: cleanPhone,
        referrerName: String(referrerName).trim(),
        vehicleModel: String(vehicleModel).trim(),
        discountType: "FLAT",
        discountValue: Number(discountValue) || 200,
        usageLimit: Number(usageLimit) || 5,
        isActive: true,
      },
      { new: true, upsert: true }
    );

    const botNumber = process.env.WHATSAPP_BOT_NUMBER || "919270199836";
    const prefilledText = `Hi MECHHELP, I want to book a car service using referral code ${cleanPlate}`;
    const botLink = `https://wa.me/${botNumber}?text=${encodeURIComponent(prefilledText)}`;
    const shareMessage = `Use my vehicle referral code *${cleanPlate}* on MECHHELP to get ₹${referral.discountValue} OFF your car service! Click here to book on WhatsApp: ${botLink}`;
    const shareLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;

    return {
      success: true,
      referralCode: referral.referralCode,
      vehiclePlateNumber: referral.vehiclePlateNumber,
      referrerPhone: referral.referrerPhone,
      discountValue: referral.discountValue,
      botNumber,
      botLink,
      shareLink,
      shareMessage,
    };
  }

  /**
   * Validate a referral code (vehicle plate number) for a user attempting to book a service.
   */
  async validateReferralCode(rawCode, refereePhone = "") {
    let cleanCode = this.extractPlateNumber(rawCode);
    if (!cleanCode) {
      cleanCode = this.normalizePlate(rawCode);
    }
    if (!cleanCode) {
      return { valid: false, discountValue: 0, reason: "No code provided", message: "No referral code provided." };
    }

    const referral = await Referral.findOne({ referralCode: cleanCode, isActive: true });
    if (!referral) {
      return { valid: false, discountValue: 0, reason: "Invalid or inactive referral code", message: `Referral code *${cleanCode}* is invalid or inactive.` };
    }

    if (referral.expiresAt && referral.expiresAt < new Date()) {
      return { valid: false, discountValue: 0, reason: "Referral code has expired", message: `Referral code *${cleanCode}* has expired.` };
    }

    if (referral.timesUsed >= referral.usageLimit) {
      return { valid: false, discountValue: 0, reason: "Referral code usage limit reached", message: `Referral code *${cleanCode}* has reached its maximum usage limit.` };
    }

    // Check self-referral (prevent referrer from using their own plate for discount)
    if (refereePhone) {
      const cleanReferee = String(refereePhone).replace(/[^0-9]/g, "").trim();
      const cleanReferrer = String(referral.referrerPhone).replace(/[^0-9]/g, "").trim();
      if (cleanReferee && cleanReferrer && cleanReferee === cleanReferrer) {
        return { valid: false, discountValue: 0, reason: "Self-referral is not allowed", message: "You cannot use your own vehicle plate number as a referral code." };
      }
    }

    return {
      valid: true,
      referralCode: referral.referralCode,
      vehiclePlateNumber: referral.vehiclePlateNumber,
      referrerPhone: referral.referrerPhone,
      referrerName: referral.referrerName,
      discountType: referral.discountType,
      discountValue: referral.discountValue,
      message: `🎉 Referral code *${referral.referralCode}* is valid! ₹${referral.discountValue} OFF will be applied to your service quote.`,
    };
  }

  /**
   * Record a referral code redemption when a booking is confirmed.
   */
  async redeemReferral(rawCode, refereePhone, bookingDetails = {}) {
    const validation = await this.validateReferralCode(rawCode, refereePhone);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const cleanReferee = String(refereePhone || "").replace(/[^0-9]/g, "").trim();

    // Increment redemption count
    const referral = await Referral.findOneAndUpdate(
      { referralCode: validation.referralCode },
      { $inc: { timesUsed: 1 } },
      { new: true }
    );

    const redemption = await ReferralRedemption.create({
      referralCode: validation.referralCode,
      vehiclePlateNumber: validation.vehiclePlateNumber,
      referrerPhone: validation.referrerPhone,
      refereePhone: cleanReferee,
      carModelBooked: bookingDetails.carModel || "",
      originalPrice: bookingDetails.originalPrice || 0,
      discountedPrice: bookingDetails.discountedPrice || 0,
      discountApplied: validation.discountValue,
    });

    return {
      success: true,
      redemption,
      timesUsed: referral.timesUsed,
      remainingUses: referral.usageLimit - referral.timesUsed,
    };
  }
}

module.exports = new ReferralService();
