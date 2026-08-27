const aiSensyService = require("../services/aiSensyService");
const connectDB = require("../db");

process.env.MONGODB_URI =
  "mongodb+srv://sonparatey_db_user:pgYGYhorslWaGJnb@mechhelpcluster.hrzzmkp.mongodb.net/mechhelp?appName=MechHelpCluster";

async function testDzire() {
  await connectDB();

  const Car = require("../models/Car");
  const cars = await Car.find({ brand: /tata/i, model: /altroz/i }).lean();

  console.log("=== TATA ALTROZ CARS IN DB ===");
  cars.forEach((c) => {
    console.log(
      `ID: ${c._id} | Model: "${c.model}" | Year: "${c.year}" | Fuel: "${c.fuelType}" | PricingCat: "${c.pricingCategory}"`
    );
    const match = carService._rowMatchesYearFilter(c.year, null, "2010");
    console.log(`Matches '2010'? -> ${match}`);
  });

  process.exit(0);
}

testDzire();
