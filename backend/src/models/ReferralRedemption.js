const mongoose = require("mongoose");

const redemptionSchema = new mongoose.Schema(
  {
    referralCode: { type: String, required: true, index: true },
    vehiclePlateNumber: { type: String, required: true },
    referrerPhone: { type: String, required: true },
    refereePhone: { type: String, required: true },
    carModelBooked: { type: String, default: "" },
    originalPrice: { type: Number },
    discountedPrice: { type: Number },
    discountApplied: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReferralRedemption", redemptionSchema);
