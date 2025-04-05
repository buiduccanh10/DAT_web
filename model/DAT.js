const mongoose = require("mongoose");

const DAT = new mongoose.Schema({
  STT: String,
  MaPhien: String,
  TiLe: String,
  KhoaHoc: String,
  MaHocVien: String,
  HoTen: String,
  HoTenGiaoVien: String,
  MaGiaoVien: String,
  XeTapLai: String,
  NgayDaoTao: String,
  ThoiGian: String,
  QuangDuong: String,
  TenDanhSachDAT:String
});

const Dat = mongoose.model(
  "DAT",
  DAT,
  "DAT"
);

module.exports = Dat;
