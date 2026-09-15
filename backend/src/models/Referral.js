const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    referralCode: { type: String, required: true, unique: true, uppercase: true, index: true },
    vehiclePlateNumber: { type: String, required: true, uppercase: true },
    vehicleModel: { type: String, default: "" },
    referrerPhone: { type: String, required: true, index: true },
    referrerName: { type: String, default: "Valued Customer" },
    discountType: { type: String, enum: ["FLAT", "PERCENTAGE"], default: "FLAT" },
    discountValue: { type: Number, default: 200 }, // Default ₹200 OFF
    usageLimit: { type: Number, default: 5 },       // Max redemptions per code
    timesUsed: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Referral", referralSchema);
