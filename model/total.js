const mongoose = require("mongoose");

const totalSchema = new mongoose.Schema({
  Anh: String,
  MaHocVien: String,
  HoTen: String,
  NgaySinh: String,
  GioiTinh: String,
  SoCMT:String,
  TongThoiGianXeSoTuDong:String,
  TongQuangDuongXeSoTuDong:Number,
  TotalMorningTime: String,
  TotalEveningTime: String,
  TotalMorningDistance: Number,
  TotalEveningDistance: Number,
  TotalDuration: String,
  TotalDistance: Number,
  Category: String,
  TrangThai: Boolean,
  LyDo:String
});

const Total = mongoose.model("Total", totalSchema, "total");

module.exports = Total;
