const mongoose = require("mongoose");

const studentDateDATSchema = new mongoose.Schema({
  MaHocVien:String,
  HoTen:String,
  KhoaHoc:String,
  startDate: String,
  endDate: String,
  startDateB11: String,
  endDateB11: String,
});

const studDateDATSchema = mongoose.model("Student Date DAT", studentDateDATSchema, "studentDateDAT");

module.exports = studDateDATSchema;
