const mongoose = require("mongoose");

const dat_sessionSchema = new mongoose.Schema({
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
  QuangDuong: Number,
  TrangThai: Boolean,
  LyDoLoai:String,
  ThoiGianBanDem: Number,
  ThoiGianXeTuDong: Number,
  QuangDuongXeTuDong:Number,
  TotalMorningTime: Number,
  TotalEveningTime: Number,
  TotalMorningDistance: Number,
  TotalEveningDistance: Number,
  TenDanhSachDAT:String
});

const Dat_session = mongoose.model(
  "Dat_session",
  dat_sessionSchema,
  "dat_session"
);

module.exports = Dat_session;
