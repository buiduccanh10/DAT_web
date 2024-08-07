const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  STT: String,
  MaHocVien: String,
  KhoaHoc:String,
  MaKhoaHoc:String,
  HoTen: String,
  NgaySinh: String,
  GioiTinh: String,
  SoCMT: String,
  NgayCapCMT: String,
  NoiCapCMT: String,
  NgayNhanHoSo: String,
  SoGPLX: String,
  HangGPLX: String,
  NoiCapGPLX: String,
  Anh: String,
});

const Student = mongoose.model("Student", studentSchema, "student_records");

module.exports = Student;
