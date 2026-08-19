const axios = require("axios");

async function testPost() {
  const url = "https://mechhelp-2.vercel.app/api/aisensy/service-plans";

  const payload = {
    selectedPlan: "Mech Basic",
    fuelType: "Petrol",
    vname: "Maruti Suzuki S Cross 2018",
  };

  console.log("🚀 Sending POST Request to Vercel Backend...");
  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
    });

    console.log("\n✅ Response Status:", response.status);
    console.log("\n📦 Response Data:\n", JSON.stringify(response.data, null, 2));
    console.log("\n📱 WhatsApp Message Output:\n");
    console.log(response.data.whatsapp_text);
  } catch (err) {
    console.error("❌ Error:", err.response ? err.response.data : err.message);
  }
}

testPost();
