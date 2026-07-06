const mongoose = require("mongoose");
const initdata = require("./data.js");
const Listing = require("../models/listing.js");

const DB_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function connectDB() {
  await mongoose.connect(DB_URL, { serverSelectionTimeoutMS: 5000 });
}

const initDB = async () => {
  await Listing.deleteMany({});
  await Listing.insertMany(initdata.data);
  console.log("Data was initialized");
};

connectDB()
  .then(async () => {
    console.log("database connected successfully");
    await initDB();
  })
  .catch((err) => {
    console.error("Failed to initialize data:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
