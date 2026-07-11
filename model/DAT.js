const mongoose = require("mongoose");

const DAT = new mongoose.Schema({
  STT: String,
  MaPhien: String,
  TiLe: String,
  KhoaHoc: String,
  MaKhoaHoc: String,
  LoaiKhoaHoc: String,
  MaHocVien: String,
  HoTen: String,
  HoTenGiaoVien: String,
  MaGiaoVien: String,
  XeTapLai: String,
  NgayDaoTao: String,
  ThoiGianKetThuc: String,
  ThoiGian: String,
  QuangDuong: String,
  ThoiGianBanDem: Number,
  ThoiGianXeTuDong: Number,
  ThoiGianMayChu: String,
  MaThietBi: String,
  SoGTVT: String,
  CoSoDaoTao: String,
  TenDanhSachDAT:String
});

const Dat = mongoose.model(
  "DAT",
  DAT,
  "DAT"
);

module.exports = Dat;
