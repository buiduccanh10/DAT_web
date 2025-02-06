const mongoose = require("mongoose");

const dateDATSchema = new mongoose.Schema({
  KhoaHoc:String,
  startDate: String,
  endDate: String,
  startDateB11: String,
  endDateB11: String,
});

const dateDAT = mongoose.model("Date DAT", dateDATSchema, "dateDAT");

module.exports = dateDAT;
