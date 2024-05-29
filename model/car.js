const mongoose = require("mongoose");

const carSchema = new mongoose.Schema({
  BienSoXe:String,
  LoaiHangXe:String
});

const Car = mongoose.model("Car", carSchema, "car_records");

module.exports = Car;
