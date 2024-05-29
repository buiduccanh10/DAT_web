const mongoose = require("mongoose");

const dat_sessionSchema = new mongoose.Schema({
  _id: String,
  STT: String,
  MaPhien: String,
  TiLe: String,
  KhoaHoc: String,
  MaHocVien: String,
  HoTen: String,
  HoTenGiaoVien: String,
  XeTapLai: String,
  NgayDaoTao: String,
  ThoiGian: String,
  QuangDuong: Number,
  TrangThai: Boolean,
  LyDoLoai:String,
  ThoiGianXeTuDong:Number,
  QuangDuongXeTuDong:Number,
  TotalMorningTime: Number,
  TotalEveningTime: Number,
  TotalMorningDistance: Number,
  TotalEveningDistance: Number,
});

const Dat_session = mongoose.model(
  "Dat_session",
  dat_sessionSchema,
  "dat_session"
);

module.exports = Dat_session;
