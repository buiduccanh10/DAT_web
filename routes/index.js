var express = require("express");
var router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const moment = require("moment");
const xml2js = require("xml2js");
const path = require("path");
const fs = require("fs");
const Student = require("../model/student");
const Dat_session = require("../model/dat_session");
const DAT = require("../model/DAT");
const Total = require("../model/total");
const Car = require("../model/car");
const dateDAT = require("../model/dateDAT");
const studentDateDAT = require("../model/studentDateDAT");
const excel = require("excel4node");

function cleanCarPlate(plate) {
  if (!plate) return "";
  return String(plate).replace(/[-,.\s]/g, "").trim().toUpperCase();
}

function isAutoCar(loaiHang) {
  if (!loaiHang) return false;
  const hang = String(loaiHang).replace(/[\r\n\s]+/g, "").trim().toUpperCase();
  return hang === "B11" || hang === "B1" || hang === "B.01" || hang.includes("B11") || hang.includes("TỰĐỘNG");
}

function findMatchingCar(cars, plate) {
  const target = cleanCarPlate(plate);
  if (!target || !Array.isArray(cars)) return null;
  const matches = cars.filter((car) => cleanCarPlate(car.BienSoXe) === target);
  if (matches.length === 0) return null;
  return (
    matches.find((c) => c.LoaiHangXe && String(c.LoaiHangXe).trim() !== "") ||
    matches[0]
  );
}

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { layout: "layout" });
});

router.get("/dashboard", function (req, res, next) {
  res.render("dashBoard", { layout: "layout" });
});

router.get("/dateDAT", async function (req, res, next) {
  const datemain = await dateDAT.find({}).lean();

  res.render("dateDAT", { datemain });
});

router.get("/studentDateDAT", async function (req, res, next) {
  const studDateDAT = await studentDateDAT.find({}).lean();

  res.render("studentDateDAT", { studDateDAT });
});

router.get("/xml", function (req, res, next) {
  res.render("xml_view", {});
});

router.get("/car", function (req, res, next) {
  res.render("car", { title: "Car input" });
});

router.get("/allCar", async function (req, res, next) {
  try {
    const cars = await Car.find({}).lean();
    res.render("allCar", { cars });
  } catch (err) {
    console.error("Error fetching cars:", err);
    res.status(500).send("Error fetching cars list.");
  }
});

router.get("/allStudent", async function (req, res, next) {
  // Exclude 'Anh' to prevent massive HTML payloads and speed up load time significantly
  const student = await Student.find({}).select('-Anh').lean();

  student.sort((a, b) => {
    return parseInt(a.STT) - parseInt(b.STT);
  });

  res.render("student", { student });
});

router.get("/student-image/:id", async function (req, res, next) {
  try {
    const student = await Student.findById(req.params.id).select('Anh').lean();
    if (student && student.Anh) {
      const imgBuffer = Buffer.from(student.Anh, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': imgBuffer.length
      });
      res.end(imgBuffer);
    } else {
      res.status(404).send('No image found');
    }
  } catch (err) {
    res.status(500).send('Error');
  }
});

router.get("/student-image-by-mahv/:mahv", async function (req, res, next) {
  try {
    const student = await Student.findOne({ MaHocVien: req.params.mahv }).select('Anh').lean();
    if (student && student.Anh) {
      const imgBuffer = Buffer.from(student.Anh, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': imgBuffer.length
      });
      res.end(imgBuffer);
    } else {
      res.status(404).send('No image found');
    }
  } catch (err) {
    res.status(500).send('Error');
  }
});
router.get("/allDat_session", async function (req, res, next) {
  const distinctTenDanhSach = await DAT.distinct("TenDanhSachDAT").lean();
  // const dat_ss = await Dat_session.find({TenDanhSachDAT:});

  res.render("allDat_session", { distinctTenDanhSach });
});

router.get("/allTotal", async function (req, res, next) {
  const distinctTenDanhSach = await DAT.distinct("TenDanhSachDAT").lean();

  res.render("total", { distinctTenDanhSach });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Helper escape regex
function escapeRegex(string) {
  return String(string).replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

// Chuẩn hoá key: bỏ ký tự xuống dòng (\n) và rút gọn khoảng trắng dư.
function normalizeRow(row) {
  const out = {};
  for (const key of Object.keys(row)) {
    const cleanKey = key.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    out[cleanKey] = row[key];
  }
  return out;
}

// File DAT mới có thể có nhiều sheet, dòng tiêu đề có thể nằm ở dòng thứ 6 (sau meta).
// Dò qua các dòng của sheet để tìm dòng chứa đồng thời cột "STT" và "Mã phiên học".
function pickDataSheet(workbook) {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet || !sheet["!ref"]) continue;

    // Đọc dạng mảng các dòng (header: 1) để tìm vị trí dòng tiêu đề
    const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!matrix || matrix.length === 0) continue;

    const maxCheckRows = Math.min(matrix.length, 25);
    for (let r = 0; r < maxCheckRows; r++) {
      const rowArr = matrix[r];
      if (!Array.isArray(rowArr)) continue;
      const cleanHeaders = rowArr.map((cell) =>
        String(cell || "").replace(/\n/g, " ").replace(/\s+/g, " ").trim()
      );
      if (cleanHeaders.includes("STT") && cleanHeaders.includes("Mã phiên học")) {
        const rows = xlsx.utils.sheet_to_json(sheet, { range: r, defval: "" });
        if (rows.length > 0) {
          return rows.filter((item) => {
            const normalized = normalizeRow(item);
            return normalized["Mã phiên học"] && String(normalized["Mã phiên học"]).trim() !== "";
          });
        }
      }
    }
  }

  // Fallback: sheet đầu tiên
  return xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
}

router.post("/upload", upload.single("file"), (req, res) => {
  const filePath = req.file.path;

  // Đọc file Excel với tùy chọn cellDates: true
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  let data = pickDataSheet(workbook);

  // Chuẩn hoá toàn bộ key của mỗi dòng
  data = data.map(normalizeRow);

  data = data.map((row) => {
    // 1. Chuẩn hóa ngày giờ sang chuỗi DD/MM/YYYY HH:mm:ss chuẩn
    const formatDateTimeField = (val) => {
      if (!val) return "";
      if (val instanceof Date) {
        return moment(val).format("MM/DD/YYYY HH:mm:ss");
      }
      const s = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const m = moment(s, "YYYY-MM-DD HH:mm:ss");
        if (m.isValid()) return m.format("DD/MM/YYYY HH:mm:ss");
      }
      return s;
    };

    row["Thời gian bắt đầu phiên học"] = formatDateTimeField(row["Thời gian bắt đầu phiên học"]);
    row["Thời gian kết thúc phiên học"] = formatDateTimeField(row["Thời gian kết thúc phiên học"]);
    if (row["Thời gian máy chủ nhận phiên học"]) {
      row["Thời gian máy chủ nhận phiên học"] = formatDateTimeField(row["Thời gian máy chủ nhận phiên học"]);
    }
    if (row["Thời gian máy chủ NCC, CSĐT nhận được dữ liệu"]) {
      row["Thời gian máy chủ NCC, CSĐT nhận được dữ liệu"] = formatDateTimeField(row["Thời gian máy chủ NCC, CSĐT nhận được dữ liệu"]);
    }

    // 2. Chuẩn hóa Tên khóa học và Loại khóa học
    const maKhoaHoc = String(row["Mã khóa học"] || "").trim();
    const hangDaoTao = String(row["Hạng đào tạo"] || "").trim();
    let loaiKhoaHoc = String(row["Loại khóa học"] || "").trim();
    let tenKhoaHoc = String(row["Tên khóa học"] || "").trim();

    if (!tenKhoaHoc && maKhoaHoc) {
      const kMatch = maKhoaHoc.match(/K\d+[A-Z0-9.-]+/i);
      tenKhoaHoc = kMatch ? kMatch[0] : maKhoaHoc;
      const isAuto = /tự\s*động|b\.01|b11/i.test(hangDaoTao) || /tự\s*động|b\.01|b11/i.test(loaiKhoaHoc);
      if (isAuto && !tenKhoaHoc.includes(".")) {
        tenKhoaHoc = tenKhoaHoc.replace(/B01(\d+)/i, "B.01$1");
      }
    }

    if (
      /tự\s*động|b\.01|b11/i.test(hangDaoTao) ||
      /tự\s*động|b\.01|b11/i.test(loaiKhoaHoc) ||
      (tenKhoaHoc && tenKhoaHoc.includes("."))
    ) {
      loaiKhoaHoc = "B1";
    } else if (/cơ\s*khí/i.test(hangDaoTao) || loaiKhoaHoc === "B" || loaiKhoaHoc === "B2") {
      loaiKhoaHoc = "B2";
    } else if (
      /\bC1\b|\bC\b|lên\s*D|lên\s*CE|lên\s*D2/i.test(hangDaoTao) ||
      (tenKhoaHoc && (tenKhoaHoc.includes("C") || tenKhoaHoc.includes("D")))
    ) {
      loaiKhoaHoc = "C";
    } else {
      loaiKhoaHoc = mapCategory(loaiKhoaHoc, tenKhoaHoc);
    }

    row["Tên khóa học"] = tenKhoaHoc;
    row["Loại khóa học"] = loaiKhoaHoc;

    // 3. Chuẩn hóa Thời gian lái xe ban đêm (giờ)
    const rawNightHour = row["Thời gian lái xe ban đêm (giờ)"];
    if (rawNightHour !== undefined && rawNightHour !== null && String(rawNightHour).trim() !== "") {
      row["Thời gian lái xe ban đêm (giờ)"] = parseFloat(rawNightHour) || 0;
    } else {
      // Tự động tính theo mốc từ 18:00 trở đi
      const thoiGianGio = parseFloat(row["Thời gian thực hành (giờ) (CSĐT truyền lên)"]) || 0;
      const thoiGianPhut = Math.round(thoiGianGio * 60);

      const startMoment = moment(row["Thời gian bắt đầu phiên học"], [
        "DD/MM/YYYY HH:mm:ss",
        "DD/MM/YY HH:mm",
        "YYYY-MM-DD HH:mm:ss",
      ]);
      if (startMoment.isValid() && thoiGianPhut > 0) {
        const cutoff18h = startMoment.clone().set({ hour: 18, minute: 0, second: 0 });
        let thoiGianToiPhut = 0;

        if (startMoment.isSameOrAfter(cutoff18h)) {
          // Bắt đầu từ 18:00 trở đi -> toàn bộ thời gian thực hành là giờ tối
          thoiGianToiPhut = thoiGianPhut;
        } else {
          // Bắt đầu trước 18:00
          const endMoment = startMoment.clone().add(thoiGianPhut, "minutes");
          if (endMoment.isAfter(cutoff18h)) {
            const thoiGianSangPhut = Math.max(0, cutoff18h.diff(startMoment, "minutes"));
            thoiGianToiPhut = Math.max(0, thoiGianPhut - thoiGianSangPhut);
          }
        }
        row["Thời gian lái xe ban đêm (giờ)"] = parseFloat((thoiGianToiPhut / 60).toFixed(2));
      } else {
        row["Thời gian lái xe ban đêm (giờ)"] = 0;
      }
    }

    // 4. Chuẩn hóa Thời gian lái xe số tự động (nếu có)
    if (
      row["Thời gian lái xe số tự động (nếu có)"] === undefined ||
      row["Thời gian lái xe số tự động (nếu có)"] === null ||
      String(row["Thời gian lái xe số tự động (nếu có)"]).trim() === ""
    ) {
      row["Thời gian lái xe số tự động (nếu có)"] = 0;
    }

    // 5. Chuẩn hóa Tỉ lệ nhận diện và Trạng thái
    const trangThai = String(row["Trạng thái"] || "").trim();
    if (
      row["Tỉ lệ nhận diện"] === undefined ||
      row["Tỉ lệ nhận diện"] === null ||
      String(row["Tỉ lệ nhận diện"]).trim() === ""
    ) {
      if (trangThai && /nhỏ\s*hơn\s*75%|< ?75%/i.test(trangThai)) {
        row["Tỉ lệ nhận diện"] = 0;
      } else {
        row["Tỉ lệ nhận diện"] = 100;
      }
    }

    return row;
  });

  // Hiển thị dữ liệu
  res.render("index", { data: data });
});

router.post("/uploadCar", upload.single("file"), (req, res) => {
  const filePath = req.file.path;

  // Đọc file Excel với tùy chọn cellDates: true
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let data = xlsx.utils.sheet_to_json(sheet);

  data = data
    .map((row) => {
      const normalized = {};
      for (const key of Object.keys(row)) {
        const cleanKey = key.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        normalized[cleanKey] = row[key];
      }

      const keys = Object.keys(normalized);
      const bienSoKey = keys.find((k) =>
        /biển\s*số|bsx|biển\s*kiểm\s*soát/i.test(k)
      );
      let hangXeKey = keys.find((k) =>
        /loại\s*hạng|hạng\s*xe|hạng|loại\s*xe|ghi\s*chú/i.test(k)
      );

      // Fallback nếu file chỉ có 2 cột (cột 1 là biển số, cột 2 là hạng xe)
      if (!hangXeKey && keys.length >= 2) {
        hangXeKey = keys.find((k) => k !== bienSoKey && !/^stt$/i.test(k));
      }

      if (bienSoKey) {
        normalized["Biển số"] = cleanCarPlate(normalized[bienSoKey]);
      }
      if (hangXeKey) {
        normalized["Loại hạng xe"] = String(normalized[hangXeKey] || "")
          .replace(/[\r\n\s]+/g, "")
          .trim()
          .toUpperCase();
      }

      return normalized;
    })
    .filter((row) => row["Biển số"]);

  // Hiển thị dữ liệu
  res.render("car", { data: data });
});

async function syncDatSessionAutoCars() {
  const cars = await Car.find({}).lean();
  const autoPlates = new Set(
    cars
      .filter((c) => isAutoCar(c.LoaiHangXe))
      .map((c) => cleanCarPlate(c.BienSoXe))
      .filter(Boolean)
  );
  if (autoPlates.size === 0) return;

  const sessions = await Dat_session.find({}).lean();
  const bulkOps = [];
  for (const s of sessions) {
    const plate = cleanCarPlate(s.XeTapLai);
    if (autoPlates.has(plate)) {
      const totalMin = (Number(s.TotalMorningTime) || 0) + (Number(s.TotalEveningTime) || 0);
      const totalDist =
        parseFloat(s.QuangDuong) ||
        (Number(s.TotalMorningDistance) || 0) + (Number(s.TotalEveningDistance) || 0);
      if (s.ThoiGianXeTuDong !== totalMin || s.QuangDuongXeTuDong !== totalDist) {
        bulkOps.push({
          updateOne: {
            filter: { _id: s._id },
            update: {
              $set: {
                ThoiGianXeTuDong: totalMin,
                QuangDuongXeTuDong: totalDist,
              },
            },
          },
        });
      }
    }
  }
  if (bulkOps.length > 0) {
    await Dat_session.bulkWrite(bulkOps);
  }
}

router.post("/save-car", async (req, res) => {
  const carsData = req.body;

  try {
    if (!Array.isArray(carsData) || carsData.length === 0) {
      return res.status(400).send("No car data provided");
    }

    // Chuẩn hóa và khử trùng lặp theo biển số (ưu tiên bản ghi có Loại hạng xe)
    const carMap = new Map();
    for (const item of carsData) {
      const cleanBienSo = cleanCarPlate(item.BienSoXe);
      const cleanHang = String(item.LoaiHangXe || "")
        .replace(/[\r\n\s]+/g, "")
        .trim()
        .toUpperCase();
      if (!cleanBienSo) continue;

      const existing = carMap.get(cleanBienSo);
      if (!existing || (!existing.LoaiHangXe && cleanHang)) {
        carMap.set(cleanBienSo, {
          BienSoXe: cleanBienSo,
          LoaiHangXe: cleanHang,
        });
      }
    }

    const uniqueCars = Array.from(carMap.values());
    const plates = uniqueCars.map((c) => c.BienSoXe);

    // Xóa các bản ghi cũ trùng biển số hoặc các bản ghi cũ bị rỗng Loại hạng xe
    await Car.deleteMany({
      $or: [
        { BienSoXe: { $in: plates } },
        { LoaiHangXe: { $in: ["", null] } },
      ],
    });

    if (uniqueCars.length > 0) {
      await Car.insertMany(uniqueCars);
    }

    await syncDatSessionAutoCars();

    res.status(200).send("Data saved successfully!");
  } catch (error) {
    res.status(500).send("Error saving data: " + error.message);
  }
});

router.post("/submitCar", async (req, res) => {
  try {
    const { id, BienSoXe, LoaiHangXe } = req.body;
    const cleanBienSo = cleanCarPlate(BienSoXe);
    const cleanHang = LoaiHangXe
      ? String(LoaiHangXe).replace(/[\r\n\s]+/g, "").trim().toUpperCase()
      : "";

    if (!cleanBienSo || !cleanHang) {
      return res.status(400).send("Biển số xe và Loại hạng xe không được để trống!");
    }

    if (id && id !== "") {
      await Car.findByIdAndUpdate(id, { BienSoXe: cleanBienSo, LoaiHangXe: cleanHang });
    } else {
      await Car.deleteMany({ BienSoXe: cleanBienSo });
      await Car.create({ BienSoXe: cleanBienSo, LoaiHangXe: cleanHang });
    }

    await syncDatSessionAutoCars();

    res.redirect("/allCar");
  } catch (error) {
    console.error("Error submitting car:", error);
    res.status(500).send("Error submitting car: " + error.message);
  }
});

router.post("/deleteCar", async (req, res) => {
  try {
    const { id } = req.body;
    if (id) {
      await Car.findByIdAndDelete(id);
    }
    res.redirect("/allCar");
  } catch (error) {
    console.error("Error deleting car:", error);
    res.status(500).send("Error deleting car: " + error.message);
  }
});

router.post("/deleteAllCars", async (req, res) => {
  try {
    await Car.deleteMany({});
    res.redirect("/allCar");
  } catch (error) {
    console.error("Error deleting all cars:", error);
    res.status(500).send("Error deleting all cars: " + error.message);
  }
});

router.post("/save-dat", async (req, res) => {
  const data = req.body;

  try {
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).send("No data provided");
    }

    const docsToInsert = data.map((row) => ({
      STT: row.STT,
      MaPhien: row.MaPhien,
      TiLe: row.TiLe,
      KhoaHoc: row.KhoaHoc,
      MaKhoaHoc: row.MaKhoaHoc,
      LoaiKhoaHoc: row.LoaiKhoaHoc,
      MaHocVien: row.MaHocVien,
      HoTen: row.HoTen,
      HoTenGiaoVien: row.HoTenGiaoVien,
      MaGiaoVien: row.MaGiaoVien,
      XeTapLai: row.XeTapLai,
      NgayDaoTao: row.NgayDaoTao,
      ThoiGianKetThuc: row.ThoiGianKetThuc,
      ThoiGian: row.ThoiGian,
      QuangDuong: row.QuangDuong,
      ThoiGianBanDem: row.ThoiGianBanDem,
      ThoiGianXeTuDong: row.ThoiGianXeTuDong,
      TenDanhSachDAT: String(row.TenDanhSachDAT || "").trim(),
      TrangThaiPhien: row.TrangThaiPhien || "",
    }));

    await DAT.insertMany(docsToInsert);

    res.status(200).send("Data saved successfully!");
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Error saving data.");
  }
});

router.get("/save-dat-session", async (req, res) => {
  const query = req.query.tenDanhSach;

  if (query) {
    await Dat_session.deleteMany({ TenDanhSachDAT: query });
  }

  const data = await DAT.find({ TenDanhSachDAT: query }).lean();

  const cars = await Car.find({}).lean();
  const dateDATs = await dateDAT.find({}).lean();

  if (!data || data.length === 0) {
    return res.status(400).send("No data to save");
  }

  // Lưu tạm thời tất cả các phiên học
  const sessions = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    // Chuyển đổi thời gian sang phút
    // File mới: ThoiGian là số thập phân (giờ, vd 0.04, 1.5)
    // File cũ / đã format: ThoiGian là chuỗi "XhYY" (vd "1h30")
    const thoiGianPhut = parseDuration(item.ThoiGian);

    // Đọc thời gian lái xe ban đêm trực tiếp từ file DAT (giờ thập phân -> phút)
    const thoiGianBanDemGio = parseFloat(item.ThoiGianBanDem) || 0;
    const thoiGianToi = Math.round(thoiGianBanDemGio * 60);
    const thoiGianSang = Math.max(thoiGianPhut - thoiGianToi, 0);

    // Quãng đường sáng/tối chia theo tỉ lệ thời gian (file không có cột km đêm riêng)
    const tongQuangDuong = parseFloat(item.QuangDuong) || 0;
    let quangDuongToi = 0;
    let quangDuongSang = 0;
    if (thoiGianPhut > 0) {
      quangDuongToi = (tongQuangDuong * thoiGianToi) / thoiGianPhut;
      quangDuongSang = tongQuangDuong - quangDuongToi;
    }

    const matchingCar = findMatchingCar(cars, item.XeTapLai);

    // Tính thời gian & quãng đường xe số tự động (B11):
    // - Ưu tiên theo danh sách xe B11: Nếu xe thuộc danh sách B11 đã nhập thì tính toàn bộ thời gian & quãng đường của phiên là B11.
    // - Nếu xe không thuộc danh sách B11, fallback đọc từ cột Thời gian lái xe số tự động từ file DAT (nếu có).
    let thoiGianXeTuDong = 0;
    let quangDuongXeTuDong = 0;
    if (matchingCar && isAutoCar(matchingCar.LoaiHangXe)) {
      thoiGianXeTuDong = thoiGianPhut;
      quangDuongXeTuDong = tongQuangDuong;
    } else {
      const thoiGianXeTuDongGio = parseFloat(item.ThoiGianXeTuDong) || 0;
      thoiGianXeTuDong = Math.round(thoiGianXeTuDongGio * 60);
      quangDuongXeTuDong =
        thoiGianPhut > 0
          ? (tongQuangDuong * thoiGianXeTuDong) / thoiGianPhut
          : 0;
    }

    // Thêm thông tin tính toán vào mục dữ liệu
    item.TotalMorningTime = thoiGianSang;
    item.TotalEveningTime = thoiGianToi;
    item.TotalMorningDistance = quangDuongSang.toFixed(2);
    item.TotalEveningDistance = quangDuongToi.toFixed(2);

    const ngayDaoTao = moment(item.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]);
    // Tạo một mảng để lưu trữ các lý do
    const lyDoLoaiList = [];

    //dat out range date
    const matchingDateDATs = dateDATs.filter(
      (dateDAT) => dateDAT.KhoaHoc === item.KhoaHoc
    );

    let isWithinMainSchedule = true;
    if (matchingDateDATs.length > 0) {
      const sessionDate = moment(item.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]);
      isWithinMainSchedule = matchingDateDATs.some((dateDAT) => {
        let sd = dateDAT.startDate;
        let ed = dateDAT.endDate;
        if (item.KhoaHoc && item.KhoaHoc.includes(".")) {
          sd = dateDAT.startDateB11 || dateDAT.startDate;
          ed = dateDAT.endDateB11 || dateDAT.endDate;
        }
        
        const startDate = moment(sd, "DD/MM/YY");
        const endDate = moment(ed, "DD/MM/YY").endOf("day");
        return (
          sessionDate.isSameOrAfter(startDate) &&
          sessionDate.isSameOrBefore(endDate)
        );
      });
    }
    if (!isWithinMainSchedule) {
      let lyDo = `Ngoài lịch đào tạo của khoá ${item.KhoaHoc}`;
      lyDoLoaiList.push(lyDo);
    }
    const scheduleViolation = !isWithinMainSchedule;

    // Kiểm tra học viên hạng không phải B1 đi xe B11 (số tự động) vào ban đêm
    if (
      matchingCar &&
      isAutoCar(matchingCar.LoaiHangXe) &&
      thoiGianToi > 0
    ) {
      const category = mapCategory(item.LoaiKhoaHoc, item.KhoaHoc);
      if (category !== "B1") {
        lyDoLoaiList.push("Hạng của bạn không được đi B11 ban đêm");
        item.TrangThai = true;
      }
    }

    // Kiểm tra điều kiện TiLe và ThoiGian
    item["TiLe"] = Math.round(parseFloat(item["TiLe"]));
    const tiLeLessThan75 = parseInt(item["TiLe"]) < 75;
    const durationGreaterThanOrEqualTo4Hours = isDurationGreaterThan4Hours(
      item["ThoiGian"]
    );

    // Tính toán tốc độ km/h
    const thoiGianGio = thoiGianPhut / 60;
    const tocDo = thoiGianGio > 0 ? parseFloat(item.QuangDuong) / thoiGianGio : 0;
    const category = mapCategory(item.LoaiKhoaHoc, item.KhoaHoc);
    const isClassC = category === "C";
    const tocDoQuaNhanh = isClassC ? tocDo > 50 : tocDo > 60;
    const tocDoQuaNhe = tocDo > 0 && tocDo < 25;

    // Kiểm tra các điều kiện và thêm lý do vào mảng
    if (tiLeLessThan75) {
      lyDoLoaiList.push("Tỉ lệ dưới 75%");
    }
    if (durationGreaterThanOrEqualTo4Hours) {
      lyDoLoaiList.push("Quá 4h/phiên");
    }
    if (thoiGianPhut <= 5) {
      lyDoLoaiList.push("Chưa đạt thời gian tối thiểu");
    }
    if (isClassC && tocDo > 50) {
      lyDoLoaiList.push("Tốc độ vượt quá 50km/h");
    } else if (!isClassC && tocDo > 60) {
      lyDoLoaiList.push("Tốc độ vượt quá 60km/h");
    }
    if (tocDoQuaNhe) {
      lyDoLoaiList.push("Tốc độ dưới 25km/h");
    }

    const hasStatusViolation = Boolean(
      item.TrangThaiPhien &&
      item.TrangThaiPhien.trim() !== "" &&
      item.TrangThaiPhien.trim() !== "Khả dụng"
    );
    if (hasStatusViolation) {
      const statusReason = item.TrangThaiPhien.trim();
      if (!lyDoLoaiList.includes(statusReason) && !(statusReason.includes("75%") && tiLeLessThan75)) {
        lyDoLoaiList.push(statusReason);
      }
    }

    // Kết hợp các lý do thành một chuỗi
    const lyDoLoai = lyDoLoaiList.join(", ");

    // Create new Dat_session record for all cases
    const newItem = new Dat_session({
      TrangThai:
        tiLeLessThan75 ||
        durationGreaterThanOrEqualTo4Hours ||
        thoiGianPhut <= 5 ||
        scheduleViolation ||
        tocDoQuaNhanh ||
        tocDoQuaNhe ||
        hasStatusViolation,
      LyDoLoai: lyDoLoai,
      TrangThaiPhien: item.TrangThaiPhien || "",
      ThoiGianBanDem: thoiGianToi,
      ThoiGianXeTuDong: thoiGianXeTuDong,
      QuangDuongXeTuDong: quangDuongXeTuDong,
      TenDanhSachDAT: query,
      HoTen: item.HoTen,
      MaHocVien: item.MaHocVien,
      MaPhien: item.MaPhien,
      TiLe: item.TiLe,
      KhoaHoc: item.KhoaHoc,
      MaKhoaHoc: item.MaKhoaHoc,
      LoaiKhoaHoc: item.LoaiKhoaHoc,
      HoTenGiaoVien: item.HoTenGiaoVien,
      MaGiaoVien: item.MaGiaoVien,
      XeTapLai: item.XeTapLai,
      NgayDaoTao: item.NgayDaoTao,
      ThoiGianKetThuc: item.ThoiGianKetThuc,
      ThoiGian: item.ThoiGian,
      QuangDuong: item.QuangDuong,
      STT: item.STT,
      TotalMorningTime: thoiGianSang,
      TotalEveningTime: thoiGianToi,
      TotalMorningDistance: quangDuongSang.toFixed(2),
      TotalEveningDistance: quangDuongToi.toFixed(2),
    });

    // Save to database
    try {
      await newItem.save();
      sessions.push(newItem);
    } catch (err) {
      console.error("Error saving data:", err);
    }
  }

  // Gom nhóm các phiên học theo học viên và ngày
  const studentMap = new Map();

  sessions.forEach((session) => {
    const studentId = session.MaHocVien;
    const date = moment(session.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]).format(
      "DD/MM/YY"
    ); // Chỉ lấy phần ngày

    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, new Map());
    }

    const dateMap = studentMap.get(studentId);

    if (!dateMap.has(date)) {
      dateMap.set(date, {
        sessions: [],
        totalDuration: 0,
        totalDistance: 0,
      });
    }

    const dayData = dateMap.get(date);
    dayData.sessions.push(session);
    dayData.totalDuration +=
      session.TotalMorningTime + session.TotalEveningTime;
    dayData.totalDistance +=
      session.TotalMorningDistance + session.TotalEveningDistance;
  });

  const updates = [];

  for (const [studentId, dateMap] of studentMap.entries()) {
    for (const [date, data] of dateMap.entries()) {
      // Check if the day total duration or distance exceed limits
      if (data.totalDuration > 600 || data.totalDistance > 500) {
        let latestSession = null;
        let latestEndTime = null;

        // Find the latest end time session in the day
        for (const session of data.sessions) {
          const endTime = moment(session.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]); // Assuming endDateTime in a different format as date and time combined
          if (!latestEndTime || endTime.isAfter(latestEndTime)) {
            latestSession = session;
            latestEndTime = endTime;
          }
        }

        if (latestSession) {
          const reason = `Ngày ${date} có tổng thời gian hoặc km quá giới hạn / ngày`;
          // Update the last session in the day
          latestSession.TrangThai = true;
          latestSession.LyDoLoai = latestSession.LyDoLoai
            ? `${latestSession.LyDoLoai}, ${reason}`
            : reason;

          // Collect the updated session for database update
          updates.push(latestSession);
        }
      }
    }
  }

  // Assuming you have grouped sessions as described above in studentMap
  for (const [studentId, dateMap] of studentMap.entries()) {
    for (const [date, data] of dateMap.entries()) {
      const sessions = data.sessions;

      // Sort sessions by start time to ensure chronological order
      sessions.sort((a, b) => {
        const startA = moment(a.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]);
        const startB = moment(b.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]);
        return startA - startB;
      });

      // Check for breaks less than 15 minutes between sessions
      for (let i = 0; i < sessions.length - 1; i++) {
        const currentSession = sessions[i];
        const nextSession = sessions[i + 1];

        // Calculate time difference between sessions
        const startCurrent = moment(
          currentSession.NgayDaoTao,
          ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm", "YYYY-MM-DD HH:mm:ss"]
        );
        const endCurrent = startCurrent
          .clone()
          .add(parseDuration(currentSession.ThoiGian), "minutes");
        const startNext = moment(nextSession.NgayDaoTao, [
          "DD/MM/YYYY HH:mm:ss",
          "DD/MM/YY HH:mm",
          "YYYY-MM-DD HH:mm:ss",
        ]);

        const breakTime = startNext.diff(endCurrent, "minutes");

        // If the break time is less than 15 minutes, mark session with issue
        if (breakTime < 15) {
          const reason = "Nghỉ giữa phiên < 15 phút";

          if (!currentSession.TrangThai) {
            currentSession.TrangThai = true;
            currentSession.LyDoLoai = reason;
          } else if (!currentSession.LyDoLoai.includes(reason)) {
            currentSession.LyDoLoai += `, ${reason}`;
          }

          if (!nextSession.TrangThai) {
            nextSession.TrangThai = true;
            nextSession.LyDoLoai = reason;
          } else if (!nextSession.LyDoLoai.includes(reason)) {
            nextSession.LyDoLoai += `, ${reason}`;
          }

          updates.push(currentSession);
          updates.push(nextSession);
        }
      }
    }
  }

  const teacherMap = new Map();

  // Group sessions by teacher and date
  sessions.forEach((session) => {
    const teacher = session.MaGiaoVien;
    if (!teacher) return;
    const date = moment(session.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm", "DD/MM/YY", "YYYY-MM-DD HH:mm:ss"]).format("DD/MM/YY");
    const startDateTime = moment(session.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm", "YYYY-MM-DD HH:mm:ss"]);
    const endDateTime = startDateTime
      .clone()
      .add(parseDuration(session.ThoiGian), "minutes");

    if (!teacherMap.has(teacher)) {
      teacherMap.set(teacher, new Map());
    }

    const dateMap = teacherMap.get(teacher);

    if (!dateMap.has(date)) {
      dateMap.set(date, []);
    }

    dateMap.get(date).push({
      startDateTime,
      endDateTime,
      bienSoXe: session.XeTapLai,
      session,
    });
  });

  for (const [teacher, dateMap] of teacherMap.entries()) {
    for (const [date, sessions] of dateMap.entries()) {
      // Check if teacher exceeds 10 hours per day (600 minutes)
      let totalTeachingTimePerDay = 0;
      sessions.forEach((sessionData) => {
        totalTeachingTimePerDay += parseDuration(sessionData.session.ThoiGian);
      });

      if (totalTeachingTimePerDay > 600) {
        // 600 minutes = 10 hours
        const reason = `Giáo viên dạy quá 10 tiếng trong ngày ${date}`;
        sessions.forEach((sessionData) => {
          const session = sessionData.session;
          session.TrangThai = true;
          if (session.LyDoLoai) {
            if (!session.LyDoLoai.includes(reason)) {
              session.LyDoLoai += `, ${reason}`;
            }
          } else {
            session.LyDoLoai = reason;
          }
          updates.push(session);
        });
      }

      // Check for overlapping sessions (existing code)
      for (let i = 0; i < sessions.length; i++) {
        for (let j = i + 1; j < sessions.length; j++) {
          const session1 = sessions[i];
          const session2 = sessions[j];

          if (
            session1.bienSoXe !== session2.bienSoXe &&
            isOverlapping(
              session1.startDateTime,
              session1.endDateTime,
              session2.startDateTime,
              session2.endDateTime
            )
          ) {
            const student1 = session1.session;
            const student2 = session2.session;

            const reason1 = `Giáo viên có phiên trùng lặp với học viên ${student2.HoTen} (Mã: ${student2.MaHocVien}, Khóa: ${student2.KhoaHoc})`;
            const reason2 = `Giáo viên có phiên trùng lặp với học viên ${student1.HoTen} (Mã: ${student1.MaHocVien}, Khóa: ${student1.KhoaHoc})`;

            if (!student1.TrangThai) {
              student1.TrangThai = true;
              student1.LyDoLoai = reason1;
              updates.push(student1);
            } else if (!student1.LyDoLoai.includes(reason1)) {
              student1.LyDoLoai += `, ${reason1}`;
              updates.push(student1);
            }

            if (!student2.TrangThai) {
              student2.TrangThai = true;
              student2.LyDoLoai = reason2;
              updates.push(student2);
            } else if (!student2.LyDoLoai.includes(reason2)) {
              student2.LyDoLoai += `, ${reason2}`;
              updates.push(student2);
            }
          }
        }
      }
    }
  }

  // Nhóm các phiên theo ngày và xe
  const dateVehicleGroups = {};
  sessions.forEach((session) => {
    const category = mapCategory(session.LoaiKhoaHoc, session.KhoaHoc);
    if (category === "B2" || category === "C") {
      const date = moment(session.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]).format("DD/MM/YY");
      const vehicle = session.XeTapLai;
      if (!dateVehicleGroups[date]) dateVehicleGroups[date] = {};
      if (!dateVehicleGroups[date][vehicle]) dateVehicleGroups[date][vehicle] = new Set();
      dateVehicleGroups[date][vehicle].add(session.MaHocVien);
    }
  });

  for (const date in dateVehicleGroups) {
    for (const vehicle in dateVehicleGroups[date]) {
      const studentCount = dateVehicleGroups[date][vehicle].size;
      if (studentCount > 1) {
        const matchingCar = findMatchingCar(cars, vehicle);
        if (matchingCar && isAutoCar(matchingCar.LoaiHangXe)) {
          const violationReason = `Ngày ${date} xe tự động ${vehicle} có ${studentCount} học viên`;
          sessions.forEach((session) => {
            const category = mapCategory(session.LoaiKhoaHoc, session.KhoaHoc);
            if (category === "B2" || category === "C") {
              const sessionDate = moment(session.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]).format("DD/MM/YY");
              if (sessionDate === date && session.XeTapLai === vehicle) {
                session.TrangThai = true;
                if (session.LyDoLoai) {
                  if (!session.LyDoLoai.includes(violationReason)) {
                    session.LyDoLoai += `, ${violationReason}`;
                  }
                } else {
                  session.LyDoLoai = violationReason;
                }
                updates.push(session);
              }
            }
          });
        }
      }
    }
  }

  // Cập nhật số thứ tự STT cho toàn bộ phiên của học viên
  for (const [studentId, dateMap] of studentMap.entries()) {
    if (!studentId) continue;
    const allStudentSessions = await Dat_session.find({ MaHocVien: studentId }).lean();
    allStudentSessions.sort((a, b) => {
        const timeA = moment(a.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]).valueOf();
        const timeB = moment(b.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm"]).valueOf();
        if (isNaN(timeA) || isNaN(timeB)) return (a.STT || 0) - (b.STT || 0);
        return timeA - timeB;
    });
    for (let i = 0; i < allStudentSessions.length; i++) {
        const s = allStudentSessions[i];
        await Dat_session.updateOne({ _id: s._id }, { $set: { STT: i + 1 } });
    }
  }

  // Nhóm các phiên theo khóa học và xe
  const courseVehicleGroups = {}; // Cấu trúc: { [KhoaHoc]: { [XeTapLai]: Set(MaHocVien) } }
  sessions.forEach((session) => {
    const course = session.KhoaHoc;
    const vehicle = session.XeTapLai;
    if (!courseVehicleGroups[course]) {
      courseVehicleGroups[course] = {};
    }
    if (!courseVehicleGroups[course][vehicle]) {
      courseVehicleGroups[course][vehicle] = new Set();
    }
    courseVehicleGroups[course][vehicle].add(session.MaHocVien);
  });

  // Kiểm tra từng nhóm - chỉ áp dụng cho xe B11
  for (const course in courseVehicleGroups) {
    for (const vehicle in courseVehicleGroups[course]) {
      const studentCount = courseVehicleGroups[course][vehicle].size;
      const sampleSession = sessions.find(
        (s) => s.KhoaHoc === course && s.XeTapLai === vehicle
      );

      // Chỉ kiểm tra giới hạn cho xe B11 (35 học viên)
      if (sampleSession) {
        const matchingCar = findMatchingCar(cars, vehicle);
        if (
          matchingCar &&
          isAutoCar(matchingCar.LoaiHangXe) &&
          studentCount > 35
        ) {
          const violationReason = `Xe ${vehicle} trong khóa học ${course} chỉ cho phép tối đa 35 học viên, hiện có ${studentCount} học viên`;
          sessions.forEach((session) => {
            if (session.KhoaHoc === course && session.XeTapLai === vehicle) {
              session.TrangThai = true;
              if (session.LyDoLoai) {
                if (!session.LyDoLoai.includes(violationReason)) {
                  session.LyDoLoai += `, ${violationReason}`;
                }
              } else {
                session.LyDoLoai = violationReason;
              }
              updates.push(session);
            }
          });
        }
      }
    }
  }

  // Lưu vào cơ sở dữ liệu
  try {
    for (const update of updates) {
      await Dat_session.updateOne(
        { _id: update._id },
        { $set: { TrangThai: update.TrangThai, LyDoLoai: update.LyDoLoai } }
      );
    }
    const dat_ss = await Dat_session.find({ TenDanhSachDAT: query }).lean();
    dat_ss.sort((a, b) => {
      if (a.KhoaHoc !== b.KhoaHoc) return String(a.KhoaHoc || "").localeCompare(String(b.KhoaHoc || ""));
      if (a.MaHocVien !== b.MaHocVien) return String(a.MaHocVien || "").localeCompare(String(b.MaHocVien || ""));
      const diff = (parseInt(a.STT, 10) || 0) - (parseInt(b.STT, 10) || 0);
      if (diff !== 0) return diff;
      const timeA = moment(a.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm", "YYYY-MM-DD HH:mm:ss"]).valueOf();
      const timeB = moment(b.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm", "YYYY-MM-DD HH:mm:ss"]).valueOf();
      return (timeA || 0) - (timeB || 0);
    });
    const distinctTenDanhSach = await DAT.distinct("TenDanhSachDAT").lean();

    // Gắn thêm ảnh vào `dat_ss` đã được chuyển sang cơ chế Lazy Load qua API `/student-image-by-mahv`

    // Render the view with fetched data
    res.render("allDat_session", { dat_ss, query, distinctTenDanhSach });
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Internal Server Error");
  }
});

function isOverlapping(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

const { exec } = require("child_process");
const util = require("util");
const crypto = require("crypto");
const execPromise = util.promisify(exec);
const os = require("os");

async function convertJp2ToJpegBase64(base64Data) {
  if (!base64Data) return base64Data;
  const cleanedBase64 = base64Data.trim();
  if (!cleanedBase64.startsWith("AAAADGpQ")) return cleanedBase64;

  const tmpId = crypto.randomBytes(8).toString("hex");
  const inPath = path.join(os.tmpdir(), `in_${tmpId}.jp2`);
  const outPath = path.join(os.tmpdir(), `out_${tmpId}.jpg`);
  
  try {
    fs.writeFileSync(inPath, Buffer.from(cleanedBase64, "base64"));
    // Sử dụng ffmpeg để chuyển đổi, ĐỒNG THỜI nén và thu nhỏ ảnh (scale=200px) để lưu DB cực nhẹ
    await execPromise(`ffmpeg -i "${inPath}" -vf "scale=200:-1" -q:v 5 "${outPath}" -y`);
    
    if (fs.existsSync(outPath)) {
      const outBase64 = fs.readFileSync(outPath, "base64");
      fs.unlinkSync(inPath);
      fs.unlinkSync(outPath);
      return outBase64;
    }
  } catch (error) {
    console.error("Image conversion failed:", error.message);
  } finally {
    // Dọn dẹp file tạm nếu có lỗi xảy ra giữa chừng
    if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }
  return cleanedBase64;
}

router.post("/uploadxml", upload.array("files", 15), (req, res) => {
  let dataFromAllFiles = [];

  const filePromises = req.files.map((file, index) => {
    return new Promise((resolve, reject) => {
      const filePath = file.path;

      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          return reject("Error reading file");
        }

        xml2js.parseString(data, async (err, result) => {
          if (err) {
            return reject("Error parsing XML");
          }

          let dataNode = null;
          let isDangKyKhoaHoc = false;

          if (result.BAO_CAO1 && result.BAO_CAO1.DATA) {
            dataNode = result.BAO_CAO1.DATA[0];
          } else if (result.DANG_KY_KHOA_HOC && result.DANG_KY_KHOA_HOC.DATA) {
            dataNode = result.DANG_KY_KHOA_HOC.DATA[0];
            isDangKyKhoaHoc = true;
          } else {
            return reject("Invalid XML format: Missing DATA node");
          }

          let khoaHoc = dataNode.KHOA_HOC[0].TEN_KHOA_HOC[0];
          const maKhoaHoc = dataNode.KHOA_HOC[0].MA_KHOA_HOC[0];
          
          let loaiKhoaHoc = "";
          if (khoaHoc) {
            if (khoaHoc.includes("C")) {
              loaiKhoaHoc = "C";
            } else if (khoaHoc.includes(".")) {
              loaiKhoaHoc = "B1";
            } else {
              loaiKhoaHoc = "B2";
            }
          }

          const lxArray = dataNode.NGUOI_LXS[0].NGUOI_LX || [];
          
          try {
            const dataFromXml = [];
            
            // Xử lý song song theo từng lô (batch) 15 ảnh để tối ưu tốc độ và tránh quá tải CPU/RAM
            const BATCH_SIZE = 15;
            for (let i = 0; i < lxArray.length; i += BATCH_SIZE) {
              const batch = lxArray.slice(i, i + BATCH_SIZE);
              
              const batchResults = await Promise.all(batch.map(async (lx) => {
                let anhBase64 = lx.HO_SO[0].ANH_CHAN_DUNG ? lx.HO_SO[0].ANH_CHAN_DUNG[0] : "";
                let convertedAnh = await convertJp2ToJpegBase64(anhBase64);
                
                let maHocVien = isDangKyKhoaHoc && lx.MA_DANG_KY ? lx.MA_DANG_KY[0] : (lx.MA_DK ? lx.MA_DK[0] : "");

                return {
                  STT: lx.SO_TT[0],
                  MaHocVien: maHocVien,
                  KhoaHoc: khoaHoc,
                  LoaiKhoaHoc: loaiKhoaHoc,
                  MaKhoaHoc: maKhoaHoc,
                  HoTen: lx.HO_VA_TEN[0],
                  NgaySinh: formatDate(lx.NGAY_SINH[0]),
                  GioiTinh: formatGender(lx.GIOI_TINH[0]),
                  SoCMT: lx.SO_CMT[0],
                  NgayCapCMT: lx.NGAY_CAP_CMT[0],
                  NoiCapCMT: lx.NOI_CAP_CMT[0],
                  NgayNhanHoSo: lx.HO_SO[0].NGAY_NHAN_HOSO[0],
                  SoGPLX: lx.SO_GPLX_DA_CO ? lx.SO_GPLX_DA_CO[0] : "",
                  HangGPLX: lx.HANG_GPLX_DA_CO ? lx.HANG_GPLX_DA_CO[0] : "",
                  NoiCapGPLX: lx.DV_CAP_GPLX_DACO ? lx.DV_CAP_GPLX_DACO[0] : "",
                  Anh: convertedAnh,
                };
              }));
              
              dataFromXml.push(...batchResults);
            }

            dataFromAllFiles = dataFromAllFiles.concat(dataFromXml);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  });

  Promise.all(filePromises)
    .then(() => {
      // Render the data in a table
      res.render("xml_view", { data: dataFromAllFiles });
    })
    .catch((err) => {
      res.status(500).send(err);
    });
});

router.post("/save-data", async (req, res) => {
  const data = req.body;

  if (!data || data.length === 0) {
    return res.status(400).send("No data to save");
  }

  try {
    for (const item of data) {
      // Dùng findOneAndUpdate với upsert: true để cập nhật nếu đã tồn tại, hoặc tạo mới nếu chưa.
      // Việc này giúp mã học viên luôn unique và không bị đổi _id khi lưu đè.
      await Student.findOneAndUpdate(
        { MaHocVien: item.MaHocVien },
        { $set: item },
        { upsert: true, new: true }
      );
    }

    res.redirect("/xml");
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Error saving data");
  }
});

router.post("/deleteAllStudents", async (req, res) => {
  try {
    await Student.deleteMany({});
    res.redirect("/allStudent");
  } catch (err) {
    console.error("Error deleting all students:", err);
    res.status(500).send("Error deleting all students");
  }
});

router.post("/updateSession", async (req, res) => {
  try {
    const { sessionIds } = req.body;

    if (!Array.isArray(sessionIds)) {
      return res.status(400).json({ error: "Invalid input" });
    }

    await Dat_session.updateMany(
      { _id: { $in: sessionIds } },
      { $set: { TrangThai: false, LyDoLoai: "" } }
    );

    res.status(200).json({ message: "Sessions updated successfully" });
  } catch (error) {
    console.error("Error updating sessions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Hàm tính toán tổng hợp toàn bộ các phiên của một học viên
function computeStudentMetrics(studentId, studentSessions, student, cars, tenDanhSachQuery) {
  const getSessionAutoMetrics = (s) => {
    let autoTime = Number(s.ThoiGianXeTuDong) || 0;
    let autoDist = Number(s.QuangDuongXeTuDong) || 0;
    if (autoTime === 0 && autoDist === 0 && s.XeTapLai) {
      const matchedCar = findMatchingCar(cars, s.XeTapLai);
      if (matchedCar && isAutoCar(matchedCar.LoaiHangXe)) {
        autoTime = (Number(s.TotalMorningTime) || 0) + (Number(s.TotalEveningTime) || 0);
        autoDist =
          parseFloat(s.QuangDuong) ||
          (Number(s.TotalMorningDistance) || 0) + (Number(s.TotalEveningDistance) || 0);
      }
    }
    return { autoTime, autoDist };
  };

    const studentMap = new Map();
    const missingStudents = [];

    // Process sessions from dat_ss
    dat_ss.forEach((col) => {
      const studentId = col.MaHocVien;

      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          totalMorningTime: 0,
          totalEveningTime: 0,
          TongThoiGianB11: 0,
          TongQuangDuongB11: 0,
          totalMorningDistance: 0,
          totalEveningDistance: 0,
          totalDuration: 0,
          totalDistance: 0,
          sessions: [],
          XeTapLai: new Set(),
          B1: new Set(),
          B2: new Set(),
          C: new Set(),
        });
      }

      const studentData = studentMap.get(studentId);
      const { autoTime, autoDist } = getSessionAutoMetrics(col);

      studentData.totalMorningTime += col.TotalMorningTime;
      studentData.totalEveningTime += col.TotalEveningTime;

      studentData.TongThoiGianB11 += autoTime;
      studentData.TongQuangDuongB11 += autoDist;

      studentData.totalMorningDistance += col.TotalMorningDistance;
      studentData.totalEveningDistance += col.TotalEveningDistance;

      studentData.totalDuration += col.TotalMorningTime + col.TotalEveningTime;
      studentData.totalDistance +=
        col.TotalMorningDistance + col.TotalEveningDistance;

      studentData.sessions.push(col);
      studentData.XeTapLai.add(col.XeTapLai);
    });

    const updatedStudents = [];

    for (const [studentId, data] of studentMap.entries()) {
      const allSessions = await Dat_session.find({
        MaHocVien: studentId,
        TenDanhSachDAT: tenDanhSachFilter,
      }).lean();
      let totalDuration = 0;
      let totalDistance = 0;
      allSessions.forEach((session) => {
        totalDuration += session.TotalMorningTime + session.TotalEveningTime;
        totalDistance += session.TotalMorningDistance + session.TotalEveningDistance;
      });

      // Báo cáo hiển thị tổng thực tế; chỉ dùng bản sao đã trừ phần vượt trần để xét duyệt.
      let countedTotalDuration = data.totalDuration;
      let countedTotalDistance = data.totalDistance;

      const student = await Student.findOne({ MaHocVien: studentId });

      if (!student) {
        missingStudents.push(studentId);
      }

      const studentSessions = data.sessions;
      const firstSession = studentSessions[0] || (allSessions[0] || {});
      let category = "Unknown";
      let reasons = [];

      // Phân hạng theo "Loại khóa học" (ưu tiên), fallback theo tên khóa học
      studentSessions.forEach((session) => {
        const mapped = mapCategory(session.LoaiKhoaHoc, session.KhoaHoc);
        if (mapped !== "Unknown") category = mapped;
      });
      if (category === "Unknown" && student) {
        category = mapCategory(student.LoaiKhoaHoc, student.KhoaHoc);
      }
      let studentStatus = false;
      const limitReasons = [];

      // Xe số tự động với hạng B2 và C: chỉ trừ phần vượt trần khỏi số liệu xét duyệt.
      if (category === "B2") {
        const maxAutoDistB = 80;
        const maxAutoTimeB = 95; // 1h35p
        
        if (data.TongQuangDuongB11 > maxAutoDistB) {
          const excessDist = data.TongQuangDuongB11 - maxAutoDistB;
          countedTotalDistance -= excessDist;
          limitReasons.push(
            `Quãng đường B11 vượt tối đa ${maxAutoDistB}km; phần vượt không được tính`
          );
        }
        if (data.TongThoiGianB11 > maxAutoTimeB) {
          const excessTime = data.TongThoiGianB11 - maxAutoTimeB;
          countedTotalDuration -= excessTime;
          limitReasons.push(
            `Thời gian B11 vượt tối đa ${formatTime(maxAutoTimeB)}; phần vượt không được tính`
          );
        }
      } else if (category === "C") {
        const maxAutoDistC = 50;
        const maxAutoTimeC = 65; // 1h5p

        if (data.TongQuangDuongB11 > maxAutoDistC) {
          const excessDist = data.TongQuangDuongB11 - maxAutoDistC;
          countedTotalDistance -= excessDist;
          limitReasons.push(
            `Quãng đường B11 vượt tối đa ${maxAutoDistC}km; phần vượt không được tính`
          );
        }
        if (data.TongThoiGianB11 > maxAutoTimeC) {
          const excessTime = data.TongThoiGianB11 - maxAutoTimeC;
          countedTotalDuration -= excessTime;
          limitReasons.push(
            `Thời gian B11 vượt tối đa ${formatTime(maxAutoTimeC)}; phần vượt không được tính`
          );
        }
      }

      if (category === "B1") {
        if (countedTotalDuration < 720) reasons.push("Thời gian chưa đạt 12 giờ");
        if (countedTotalDistance < 710)
          reasons.push("Quãng đường chưa đạt 710km");
        if (data.totalEveningTime < 150)
          reasons.push("Thời gian tối chưa đạt 2.5 giờ");
        if (data.totalEveningTime > 300)
          reasons.push("Thời gian tối quá 5 giờ");
        if (data.totalEveningDistance < 100)
          reasons.push("Quãng đường tối chưa đạt 100km");
        studentStatus = reasons.length > 0;
      } else if (category === "B2") {
        if (data.TongQuangDuongB11 < 60)
          reasons.push("Chưa đi đủ quãng đường B11 (tối thiểu 60km)");
        if (countedTotalDuration < 1200)
          reasons.push("Thời gian chưa đạt 20 giờ");
        if (countedTotalDistance < 810)
          reasons.push("Quãng đường chưa đạt 810km");
        if (data.totalEveningTime < 150)
          reasons.push("Thời gian tối chưa đạt 2.5 giờ");
        if (data.totalEveningTime > 300)
          reasons.push("Thời gian tối quá 5 giờ");
        if (data.totalEveningDistance < 100)
          reasons.push("Quãng đường tối chưa đạt 100km");
        studentStatus = reasons.length > 0;
      } else if (category === "C") {
        if (data.TongQuangDuongB11 < 40)
          reasons.push("Chưa đi đủ quãng đường B11 (tối thiểu 40km)");
        if (countedTotalDuration < 1440)
          reasons.push("Thời gian chưa đạt 24 giờ");
        if (countedTotalDistance < 825)
          reasons.push("Quãng đường chưa đạt 825km");
        if (data.totalEveningTime < 150)
          reasons.push("Thời gian tối chưa đạt 2.5 giờ");
        if (data.totalEveningTime > 300)
          reasons.push("Thời gian tối quá 5 giờ");
        if (data.totalEveningDistance < 70)
          reasons.push("Quãng đường tối chưa đạt 70km");
        studentStatus = reasons.length > 0;
      }

  if (totalMorningDistance < 5 && totalMorningTime < 30) {
    reasons.push("Chưa đủ điều kiện đi tối");
  }

      const avgSpeed = countedTotalDuration > 0 ? countedTotalDistance / (countedTotalDuration / 60) : 0;
      if (countedTotalDuration > 0 && avgSpeed < 25) {
        reasons.push("Tốc độ trung bình dưới 25km/h");
        studentStatus = true;
      }

      if (studentStatus) {
        reasons.push(...limitReasons);
      }

  for (let bienSoXe of xeTapLaiSet) {
    const car = findMatchingCar(cars, bienSoXe);
    if (car) {
      const hangXe = String(car.LoaiHangXe || "").replace(/[\r\n\s]+/g, "").trim().toUpperCase();
      if (isAutoCar(hangXe)) {
        b1Set.add(bienSoXe);
      } else if (hangXe === "B2" || hangXe === "B") {
        b2Set.add(bienSoXe);
      } else if (hangXe.startsWith("C") || hangXe.startsWith("D")) {
        cSet.add(bienSoXe);
      }
    }
  }

  const firstSession = studentSessions[0] || {};
  const studentStatus = reasons.length > 0;

  return {
    MaHocVien: studentId,
    KhoaHoc: student ? student.KhoaHoc : (firstSession.KhoaHoc || ""),
    MaKhoaHoc: student ? student.MaKhoaHoc : (firstSession.MaKhoaHoc || ""),
    HoTen: student ? student.HoTen : (firstSession.HoTen || ""),
    NgaySinh: student ? student.NgaySinh : (firstSession.NgaySinh || ""),
    GioiTinh: student ? student.GioiTinh : (firstSession.GioiTinh || ""),
    SoCMT: student ? student.SoCMT : (firstSession.SoCMT || ""),
    TongThoiGianXeSoTuDong: formatTime(tongThoiGianB11),
    TongQuangDuongXeSoTuDong: tongQuangDuongB11.toFixed(2),
    TotalMorningTime: formatTime(totalMorningTime),
    TotalEveningTime: formatTime(totalEveningTime),
    TotalMorningDistance: totalMorningDistance.toFixed(2),
    TotalEveningDistance: totalEveningDistance.toFixed(2),
    TotalDuration: formatTime(adjustedDuration),
    TotalDistance: adjustedDistance.toFixed(2),
    Category: category,
    TrangThai: studentStatus,
    LyDo: reasons.join(", "),
    B1: Array.from(b1Set).join(", "),
    B2: Array.from(b2Set).join(", "),
    C: Array.from(cSet).join(", "),
    TenDanhSachDAT: tenDanhSachQuery || firstSession.TenDanhSachDAT || "",
  };
}

router.get("/computeData", async (req, res) => {
  const query = req.query.tenDanhSach;
  try {
    const cars = await Car.find({}).lean();

    let tenDanhSachFilter = query;
    if (query && query.includes(',')) {
      tenDanhSachFilter = { $in: query.split(',').map(s => s.trim()) };
    }

    let studentIds = [];
    if (!query || query === "all") {
      // Tính cho toàn bộ học viên có phiên trong hệ thống
      studentIds = await Dat_session.distinct("MaHocVien");
    } else {
      // Lấy danh sách các học viên có phiên trong danh sách được chọn
      studentIds = await Dat_session.distinct("MaHocVien", {
        TenDanhSachDAT: tenDanhSachFilter,
      });
    }

    studentIds = studentIds.filter(Boolean);
    const updatedStudents = [];
    const missingStudents = [];

    for (const studentId of studentIds) {
      // Lấy TOÀN BỘ các phiên của học viên này trong hệ thống để cộng dồn chính xác
      const allStudentSessions = await Dat_session.find({ MaHocVien: studentId }).lean();
      const student = await Student.findOne({ MaHocVien: studentId }).lean();

      if (!student) {
        missingStudents.push(studentId);
      }

      const totalDoc = computeStudentMetrics(
        studentId,
        allStudentSessions,
        student,
        cars,
        query && query !== "all" ? query : ""
      );

      updatedStudents.push(totalDoc);
    }

    // Xóa các bản ghi cũ của các học viên này trong Total (xóa theo MaHocVien để triệt để loại bỏ nhân bản)
    if (updatedStudents.length > 0) {
      await Total.deleteMany({
        MaHocVien: { $in: updatedStudents.map((s) => s.MaHocVien) },
      });
      await Total.create(updatedStudents);
    }

    // Bổ sung học viên từ Student chưa từng chạy phiên nào (khi tính tất cả)
    if (!query || query === "all") {
      const existingTotalStudents = await Total.find({}).lean();
      const existingTotalIdSet = new Set(
        existingTotalStudents.map((student) => student.MaHocVien)
      );
      const students = await Student.find().lean();

      for (const student of students) {
        if (!existingTotalIdSet.has(student.MaHocVien)) {
          const category = mapCategory(student.LoaiKhoaHoc, student.KhoaHoc);
          const newTotal = new Total({
            MaHocVien: student.MaHocVien,
            HoTen: student.HoTen,
            SoCMT: student.SoCMT,
            GioiTinh: student.GioiTinh,
            NgaySinh: student.NgaySinh,
            KhoaHoc: student.KhoaHoc,
            MaKhoaHoc: student.MaKhoaHoc,
            TongThoiGianXeSoTuDong: "0h00",
            TongQuangDuongXeSoTuDong: "0.00",
            TotalMorningTime: "0h00",
            TotalEveningTime: "0h00",
            TotalMorningDistance: "0.00",
            TotalEveningDistance: "0.00",
            TotalDuration: "0h00",
            TotalDistance: "0.00",
            Category: category,
            TrangThai: true,
            LyDo: "Chưa chạy phiên",
            B1: "",
            B2: "",
            C: "",
            TenDanhSachDAT: query || "",
          });
          await newTotal.save();
        }
      }
    }

    const khoahocArray = req.query.khoahoc;

    let queryObj = {};
    if (query && query !== "all") {
      // Lọc các học viên thuộc danh sách được chọn
      queryObj.MaHocVien = { $in: studentIds };
    }

    const distinctKhoaHoc = await Total.distinct("KhoaHoc", queryObj);
    const kh = distinctKhoaHoc.map((k) => ({ KhoaHoc: k }));

    const distinctTenDanhSach = await DAT.distinct("TenDanhSachDAT").lean();

    if (khoahocArray) {
      const selectedKhoaHoc = Array.isArray(khoahocArray)
        ? khoahocArray
        : [khoahocArray];
      queryObj.KhoaHoc = { $in: selectedKhoaHoc };
    }

    const total = await Total.find(queryObj).lean();

    res.render("total", {
      total,
      kh,
      selectedKhoaHoc: khoahocArray,
      distinctTenDanhSach,
      query,
      missingStudents: missingStudents.join(", "),
    });
  } catch (err) {
    console.error("Error computing data:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/export-to-excel", (req, res) => {
  const dataByKhoaHoc = req.body.dataByKhoaHoc;

  const wb = new excel.Workbook();
  const ws = wb.addWorksheet("DAT");

  // Define styles
  const headerStyle = wb.createStyle({
    font: {
      name: "Times New Roman",
      bold: true,
      size: 16,
    },
    alignment: {
      vertical: "center",
      horizontal: "center",
    },
    fill: {
      type: "pattern",
      patternType: "solid",
      fgColor: "808080",
    },
  });

  const titleStyle = wb.createStyle({
    font: {
      name: "Times New Roman",
      bold: true,
      size: 16,
    },
    alignment: {
      vertical: "center",
      horizontal: "center",
    },
  });

  const cellGreenStyle = wb.createStyle({
    font: {
      name: "Times New Roman",
      size: 18,
      color: "cc3300",
    },
    alignment: {
      vertical: "center",
      horizontal: "center",
    },
    fill: {
      type: "pattern",
      patternType: "solid",
      fgColor: "99cc00",
    },
  });

  const cellNormalStyle = wb.createStyle({
    font: {
      name: "Times New Roman",
      size: 12,
    },
    alignment: {
      vertical: "center",
      horizontal: "center",
    },
  });

  const cellNameStudentStyle = wb.createStyle({
    font: {
      name: "Times New Roman",
      size: 12,
    },
  });

  const cellReservedStyle = wb.createStyle({
    font: {
      name: "Times New Roman",
      size: 12,
      color: "000000", // Black font color for visibility
    },
    fill: {
      type: "pattern",
      patternType: "solid",
      fgColor: "ffb3b3", // Light red background
    },
  });

  // Merge cells for the report title
  ws.cell(1, 1, 1, 5, true)
    .string("SỞ LĐTB&XH HẢI DƯƠNG")
    .style(cellNormalStyle);
  ws.cell(2, 1, 2, 5, true)
    .string("TRUNG TÂM GDNN &SHLX  THANH MIỆN")
    .style(cellNormalStyle);
  ws.cell(1, 7, 1, 13, true)
    .string("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM")
    .style(cellNormalStyle);
  ws.cell(2, 7, 2, 13, true)
    .string("Độc lập - Tự do - Hạnh phúc")
    .style(cellNormalStyle);

  // Adjusted position for the main title
  ws.cell(4, 1, 4, 12, true)
    .string(
      "BÁO CÁO KẾT QUẢ ĐÀO TẠO THỰC HÀNH LÁI XE TRÊN ĐƯỜNG GIAO THÔNG THEO DANH SÁCH THÍ SINH DỰ TỐT NGHIỆP"
    )
    .style(titleStyle);

  // Define headers with their respective widths
  const headers = [
    { header: "STT", width: 10 },
    { header: "Họ và tên học viên", width: 30 },
    { header: "Mã học viên", width: 30 },
    { header: "Ngày sinh", width: 15 },
    { header: "Số CCCD", width: 20 },
    { header: "Mã khoá học", width: 20 },
    { header: "Hạng", width: 10 },
    { header: "Thời gian đào tạo", width: 20 },
    { header: "Quãng đường đào tạo(km)", width: 35 },
    { header: "BIỂN SỐ XE", width: 20 },
    { header: "", width: 20 },
    { header: "Kết quả", width: 10 },
  ];

  // Set header row
  headers.forEach((header, index) => {
    const cell = ws
      .cell(6, index + 1)
      .string(header.header)
      .style(headerStyle);

    if (header.header === "BIỂN SỐ XE") {
      // Merge BIỂN SỐ XE with the empty header
      ws.cell(6, index + 1, 6, index + 2, true)
        .string(header.header)
        .style(headerStyle);
      ws.column(index + 1).setWidth(header.width);
    } else {
      ws.column(index + 1).setWidth(header.width);
    }
  });

  // Function to determine the sorting order
  const getSortOrder = (khoaHoc) => {
    if (khoaHoc.includes("B1")) return 1;
    if (khoaHoc.includes("B2")) return 2;
    if (khoaHoc.includes("C")) return 3;
    return 4; // fallback for any other categories
  };

  // Function to extract the numerical part of the course identifier
  const getNumericalPart = (khoaHoc) => {
    const match = khoaHoc.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // Sort the keys based on the desired order
  const sortedKeys = Object.keys(dataByKhoaHoc).sort((a, b) => {
    const orderA = getSortOrder(a);
    const orderB = getSortOrder(b);
    if (orderA !== orderB) return orderA - orderB;

    // If they have the same order, compare the rest of the strings numerically
    const numA = getNumericalPart(a);
    const numB = getNumericalPart(b);
    return numA - numB;
  });

  let rowIndex = 7;
  let overallIndex = 1; // Initialize global STT counter

  sortedKeys.forEach((khoaHoc, idx) => {
    const data = dataByKhoaHoc[khoaHoc];

    // Add header row with green background for all columns (unchanged từ trước)
    ws.cell(rowIndex, 1, rowIndex, headers.length, true)
      .string(`CHÍNH KHOÁ ${khoaHoc}`)
      .style(cellGreenStyle);
    rowIndex++;

    // Count variable to keep track of student order within each khoaHoc
    data.forEach((item) => {
      // Add global student order number (STT)
      ws.cell(rowIndex, 1).number(overallIndex).style(cellNormalStyle);

      ws.cell(rowIndex, 2).string(item["Họ tên"]).style(cellNameStudentStyle);
      ws.cell(rowIndex, 3).string(item["Mã học viên"]).style(cellNormalStyle);
      ws.cell(rowIndex, 4).string(item["Ngày sinh"]).style(cellNormalStyle);
      ws.cell(rowIndex, 5).string(item["Số CCCD"]).style(cellNormalStyle);
      ws.cell(rowIndex, 6).string(item["Mã khoá học"]).style(cellNormalStyle);
      ws.cell(rowIndex, 7).string(item["Hạng lái xe"]).style(cellNormalStyle);

      // Assign vehicle license number based on license class
      if (item["Hạng lái xe"] === "B1") {
        ws.cell(rowIndex, 10).string(item["B1"]).style(cellNormalStyle);
        ws.cell(rowIndex, 11).string("").style(cellNormalStyle); // Biển số xe B1
      } else if (item["Hạng lái xe"] === "B2") {
        ws.cell(rowIndex, 10).string(item["B2"]).style(cellNormalStyle);
        ws.cell(rowIndex, 11).string(item["B1"]).style(cellNormalStyle);
      } else if (item["Hạng lái xe"] === "C") {
        ws.cell(rowIndex, 10).string(item["C"]).style(cellNormalStyle);
        ws.cell(rowIndex, 11).string(item["B1"]).style(cellNormalStyle);
      } else {
        ws.cell(rowIndex, 10).string("").style(cellNormalStyle); // Default placeholder for other cases
        ws.cell(rowIndex, 11).string("").style(cellNormalStyle);
      }

      ws.cell(rowIndex, 8)
        .string(item["Tổng thời gian"])
        .style(cellNormalStyle);

      ws.cell(rowIndex, 9)
        .string(item["Tổng quãng đường(km)"])
        .style(cellNormalStyle);

      const ketQuaCell = ws.cell(rowIndex, 12).string(item["Kết quả"]);

      // Apply reserved style if Kết quả is Không đạt
      if (item["Kết quả"] === "Không đạt") {
        ketQuaCell.style(cellReservedStyle);
        ketQuaCell.style({ font: { color: "000000" } }); // Đặt màu chữ đen

        // Apply reserved style to all cells in the same row
        for (let col = 1; col <= headers.length; col++) {
          ws.cell(rowIndex, col).style(cellReservedStyle);
        }
      } else {
        ketQuaCell.style(cellNormalStyle);
      }

      rowIndex++;
      overallIndex++;
    });
  });

  const filename = req.body.filename || "example.xlsx";
  wb.write(filename, res);
});

router.get("/search", async function (req, res, next) {
  const courses = await dateDAT.find({}).lean();

  res.render("search", {
    title: "Search",
    query: "",
    results: [],
    sessions: [],
    courses,
  });
});

router.get("/search/results", async (req, res) => {
  try {
    const { query } = req.query; // Lấy giá trị query từ URL

    let results = [];
    let sessions = [];
    if (query) {
      const cleanQuery = query.trim();
      const escapedQuery = escapeRegex(cleanQuery);
      const nameRegex = new RegExp(escapedQuery, "i");

      // Tìm kiếm các học viên phù hợp từ Total
      let totalResults = await Total.find({
        $or: [
          { HoTen: nameRegex },
          { SoCMT: cleanQuery },
          { MaHocVien: cleanQuery },
        ],
      }).lean();

      const foundStudentIds = new Set(totalResults.map((r) => r.MaHocVien).filter(Boolean));

      // Nếu chưa có trong Total, tìm thêm từ Dat_session và Student
      if (foundStudentIds.size === 0) {
        const sessionHits = await Dat_session.find({
          $or: [{ HoTen: nameRegex }, { MaHocVien: cleanQuery }],
        }).distinct("MaHocVien");
        sessionHits.forEach((id) => { if (id) foundStudentIds.add(id); });

        const studentHits = await Student.find({
          $or: [{ HoTen: nameRegex }, { SoCMT: cleanQuery }, { MaHocVien: cleanQuery }],
        }).distinct("MaHocVien");
        studentHits.forEach((id) => { if (id) foundStudentIds.add(id); });
      }

      const cars = await Car.find({}).lean();
      const finalResultsMap = new Map();

      // Với mỗi mã học viên tìm được, luôn lấy tổng hợp đầy đủ từ TẤT CẢ các phiên của học viên đó
      for (const studentId of foundStudentIds) {
        const allStudentSessions = await Dat_session.find({ MaHocVien: studentId }).lean();
        const studentDoc = await Student.findOne({ MaHocVien: studentId }).lean();

        if (allStudentSessions.length > 0) {
          // Tính tổng hợp chính xác trên toàn bộ các phiên
          const aggregated = computeStudentMetrics(studentId, allStudentSessions, studentDoc, cars);
          finalResultsMap.set(studentId, aggregated);

          // Cập nhật lại vào Total để loại bỏ các bản ghi trùng lặp cũ
          await Total.deleteMany({ MaHocVien: studentId });
          await Total.create(aggregated);
        } else {
          const existing = totalResults.find((r) => r.MaHocVien === studentId);
          if (existing) {
            finalResultsMap.set(studentId, existing);
          }
        }
      }

      results = Array.from(finalResultsMap.values());

      // Lấy toàn bộ các phiên liên quan của tất cả học viên trong kết quả tìm kiếm
      if (results.length > 0) {
        const studentIds = results.map((result) => result.MaHocVien);
        sessions = await Dat_session.find({
          MaHocVien: { $in: studentIds },
        }).lean();

        // Sắp xếp các phiên học theo STT từ nhỏ đến lớn (1 -> N)
        sessions.sort((a, b) => {
          if (a.MaHocVien !== b.MaHocVien) {
            return String(a.MaHocVien).localeCompare(String(b.MaHocVien));
          }
          const diff = (parseInt(a.STT, 10) || 0) - (parseInt(b.STT, 10) || 0);
          if (diff !== 0) return diff;
          const timeA = moment(a.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm", "YYYY-MM-DD HH:mm:ss"]).valueOf();
          const timeB = moment(b.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm", "YYYY-MM-DD HH:mm:ss"]).valueOf();
          return (timeA || 0) - (timeB || 0);
        });
      }
    }

    // Render template và truyền dữ liệu kết quả vào
    res.render("search", { title: "Search", query, results, sessions });
  } catch (error) {
    console.error("Error searching:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/studentDetails/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const cars = await Car.find({}).lean();
    const allStudentSessions = await Dat_session.find({ MaHocVien: id }).lean();
    const studentDoc = await Student.findOne({ MaHocVien: id }).lean();

    let results = [];
    if (allStudentSessions.length > 0) {
      const aggregated = computeStudentMetrics(id, allStudentSessions, studentDoc, cars);
      results = [aggregated];
      await Total.deleteMany({ MaHocVien: id });
      await Total.create(aggregated);
    } else {
      results = await Total.find({ MaHocVien: id }).lean();
      if (results.length > 1) {
        results = [results[0]];
      }
    }

    let sessions = allStudentSessions;
    sessions.sort((a, b) => {
      const diff = (parseInt(a.STT, 10) || 0) - (parseInt(b.STT, 10) || 0);
      if (diff !== 0) return diff;
      const timeA = moment(a.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm", "YYYY-MM-DD HH:mm:ss"]).valueOf();
      const timeB = moment(b.NgayDaoTao, ["DD/MM/YYYY HH:mm:ss", "DD/MM/YY HH:mm", "YYYY-MM-DD HH:mm:ss"]).valueOf();
      return (timeA || 0) - (timeB || 0);
    });

    res.render("search", { results, sessions });
  } catch (error) {
    console.error("Error in studentDetails:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/filter", async (req, res) => {
  const { trangthai, khoahoc } = req.query;

  const courses = await dateDAT.find({}).lean();
  let tt = await Total.find({
    TrangThai: trangthai,
    KhoaHoc: khoahoc,
  }).lean();

  // Khử trùng lặp theo MaHocVien
  const uniqueMap = new Map();
  for (const item of tt) {
    if (!uniqueMap.has(item.MaHocVien)) {
      uniqueMap.set(item.MaHocVien, item);
    }
  }
  tt = Array.from(uniqueMap.values());

  res.render("search", { tt, courses, khoahoc, trangthai });
});

router.post("/deleteDate", async (req, res) => {
  const { id } = req.body;
  try {
    await dateDAT.findByIdAndDelete(id);
    res.redirect("dateDAT");
  } catch (err) {
    console.error("Error deleting date range:", err);
    res.status(500).send("Error deleting date range");
  }
});

// router.get("/updateDate", async (req, res) => {
//   const { id } = req.query;
//   try {
//     const dateRange = await dateDAT.findById(id).lean();
//     const datemain = await dateDAT.find({additional:true}).lean();
//     const datesecond = await dateDAT.find({additional:false}).lean();

//     dateRange.startDate = convertToISODate(dateRange.startDate);
//     dateRange.endDate = convertToISODate(dateRange.endDate);

//     res.render("updateDate", { dateRange, datemain,datesecond });
//   } catch (err) {
//     console.error("Error fetching date range:", err);
//     res.status(500).send("Error fetching date range");
//   }
// });

router.post("/submitDate", async (req, res) => {
  const { id, KhoaHoc, startDate, endDate, startDateB11, endDateB11 } =
    req.body;

  const formatDate = (date) => {
    const d = new Date(date);
    let day = String(d.getDate()).padStart(2, "0");
    let month = String(d.getMonth() + 1).padStart(2, "0");
    let year = String(d.getFullYear()).slice(2);
    return `${day}/${month}/${year}`;
  };

  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = formatDate(endDate);
  const formattedStartDateB11 =
    startDateB11 === "" ? "" : formatDate(startDateB11);
  const formattedEndDateB11 = endDateB11 === "" ? "" : formatDate(endDateB11);

  if (id) {
    const updateData = {
      KhoaHoc,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      startDateB11: formattedStartDateB11,
      endDateB11: formattedEndDateB11,
    };
    await dateDAT.findByIdAndUpdate(id, updateData);
  } else {
    const newCourse = new dateDAT({
      KhoaHoc,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      startDateB11: formattedStartDateB11,
      endDateB11: formattedEndDateB11,
    });
    await newCourse.save();
  }
  res.redirect("/dateDAT");
});

// router.post("/updateDate", async (req, res) => {
//   const { id, KhoaHoc, startDate, endDate } = req.body;

//   // Chuyển đổi ngày sang định dạng DD/MM/YY
//   const formatDate = (date) => {
//     const d = new Date(date);
//     let day = String(d.getDate()).padStart(2, "0");
//     let month = String(d.getMonth() + 1).padStart(2, "0");
//     let year = String(d.getFullYear()).slice(2);
//     return `${day}/${month}/${year}`;
//   };

//   const formattedStartDate = formatDate(startDate);
//   const formattedEndDate = formatDate(endDate);

//   try {
//     await dateDAT.findByIdAndUpdate(id, {
//       KhoaHoc,
//       startDate: formattedStartDate,
//       endDate: formattedEndDate,
//     });
//     res.redirect("dateDAT");
//   } catch (err) {
//     console.error("Error updating date range:", err);
//     res.status(500).send("Error updating date range");
//   }
// });

router.delete("/delete-dat-session", async (req, res) => {
  const { tenDanhSach } = req.query;
  if (!tenDanhSach) {
    return res.status(400).send("tenDanhSach is required");
  }

  const cleanName = String(tenDanhSach).trim();
  const nameRegex = new RegExp("^\\s*" + escapeRegex(cleanName) + "\\s*$", "i");
  const filter = {
    $or: [
      { TenDanhSachDAT: cleanName },
      { TenDanhSachDAT: nameRegex },
    ],
  };

  try {
    await Dat_session.deleteMany(filter);
    await DAT.deleteMany(filter);
    await Total.deleteMany(filter);

    res.status(200).send("Deleted successfully");
  } catch (err) {
    console.error("Error deleting data:", err);
    res.status(500).send("Error deleting data");
  }
});

router.delete("/deleteComputeData", async (req, res) => {
  const { tenDanhSach } = req.query;
  if (!tenDanhSach) {
    return res.status(400).send("tenDanhSach is required");
  }

  if (tenDanhSach === "all") {
    try {
      await Total.deleteMany({});
      return res.status(200).send("Deleted successfully");
    } catch (err) {
      console.error("Error deleting all total data:", err);
      return res.status(500).send("Error deleting data");
    }
  }

  const cleanName = String(tenDanhSach).trim();
  const nameRegex = new RegExp("^\\s*" + escapeRegex(cleanName) + "\\s*$", "i");
  const filter = {
    $or: [
      { TenDanhSachDAT: cleanName },
      { TenDanhSachDAT: nameRegex },
    ],
  };

  try {
    await Total.deleteMany(filter);
    await Dat_session.deleteMany(filter);
    await DAT.deleteMany(filter);

    res.status(200).send("Deleted successfully");
  } catch (err) {
    console.error("Error deleting data:", err);
    res.status(500).send("Error deleting data");
  }
});

router.get("/editStudent", async (req, res) => {
  const maHocVien = req.query.MaHocVien;
  const student = await Student.findOne({ MaHocVien: maHocVien }).lean();

  res.render("updateStudent", { student });
});

router.post("/updateStudent", async (req, res) => {
  try {
    const id = req.body.id;
    const khoaHoc = req.body.KhoaHoc;

    const updateData = {
      MaHocVien: req.body.MaHocVien,
      KhoaHoc: khoaHoc,
      MaKhoaHoc: "30012" + khoaHoc,
      HoTen: req.body.HoTen,
      NgaySinh: formatDateString(req.body.NgaySinh),
      GioiTinh: req.body.GioiTinh,
      SoCMT: req.body.SoCMT,
    };

    const updatedStudent = await Student.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedStudent) {
      return res.status(404).send("Student not found");
    }

    res.redirect("/allStudent");
  } catch (err) {
    console.error("Error updating student:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/deleteStudent", async (req, res) => {
  const maHocVien = req.body.MaHocVien;
  await Student.deleteOne({ MaHocVien: maHocVien });
  res.redirect("/allStudent");
});

router.post("/searchStudent", async (req, res) => {
  const { mahocvien } = req.body;
  const student = await Student.findOne({ MaHocVien: mahocvien }).lean();
  res.json(student);
});

router.post("/submitStudentDateDAT", async (req, res) => {
  const {
    id,
    MaHocVien,
    HoTen,
    KhoaHoc,
    startDate,
    endDate,
    startDateB11,
    endDateB11,
  } = req.body;

  const formatDate = (date) => {
    const d = new Date(date);
    let day = String(d.getDate()).padStart(2, "0");
    let month = String(d.getMonth() + 1).padStart(2, "0");
    let year = String(d.getFullYear()).slice(2);
    return `${day}/${month}/${year}`;
  };

  if (id) {
    const updateDate = {
      MaHocVien: MaHocVien,
      HoTen: HoTen,
      KhoaHoc: KhoaHoc,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      startDateB11: startDateB11 === "" ? "" : formatDate(startDateB11),
      endDateB11: endDateB11 === "" ? "" : formatDate(endDateB11),
    };
    await studentDateDAT.findByIdAndUpdate(id, updateDate);
  } else {
    const newDate = new studentDateDAT({
      MaHocVien: MaHocVien,
      HoTen: HoTen,
      KhoaHoc: KhoaHoc,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      startDateB11: startDateB11 === "" ? "" : formatDate(startDateB11),
      endDateB11: endDateB11 === "" ? "" : formatDate(endDateB11),
    });
    await newDate.save();
  }
  res.redirect("/studentDateDAT");
});

router.post("/deleteStudentDateDAT", async (req, res) => {
  const { id } = req.body;
  try {
    await studentDateDAT.findByIdAndDelete(id);
    res.redirect("studentDateDAT");
  } catch (err) {
    console.error("Error deleting date range:", err);
    res.status(500).send("Error deleting date range");
  }
});

function convertToISODate(dateStr) {
  const [day, month, year] = dateStr.split("/");
  return `20${year}-${month}-${day}`; // Giả sử năm là 20xx
}

// function parseDuration(duration) {
//   const [hours, minutes] = duration.split("h").map(Number);
//   return hours * 60 + minutes;
// }

function parseDuration(duration) {
  if (duration == null) return 0;

  // File DAT mới: thời gian là số thập phân (giờ, vd 0.04, 1.5)
  if (typeof duration === "number") {
    return Math.round(duration * 60);
  }

  // File cũ / đã format: chuỗi "XhYY" (vd "1h30") hoặc chuỗi thập phân "1.5"
  if (typeof duration === "string") {
    if (duration.includes("h")) {
      const [hoursString, minutesString] = duration.split("h");
      const hours = parseInt(hoursString, 10) || 0;
      const minutes = parseInt(minutesString, 10) || 0;
      return hours * 60 + minutes;
    } else {
      const parsedFloat = parseFloat(duration);
      if (!isNaN(parsedFloat)) {
        return Math.round(parsedFloat * 60);
      }
    }
  }

  return 0;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins < 10 ? "0" : ""}${mins}`;
}

const formatDateString = (date) => {
  const d = new Date(date);
  let month = "" + (d.getMonth() + 1);
  let day = "" + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
};

function formatInputTime(decimalHours) {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes}`;
}

function formatDate(dateString) {
  // Chuyển đổi từ 'YYYYMMDD' sang 'YYYY-MM-DD'
  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);
  return `${year}-${month}-${day}`;
}

function formatGender(gender) {
  if (gender == "M") {
    return "Nam";
  } else {
    return "Nữ";
  }
}

const isDurationGreaterThan4Hours = (duration) => {
  return parseDuration(duration) >= 240; // 4 hours in minutes
};

// Phân hạng B1/B2/C dựa trên "Loại khóa học" (cột mới trong file DAT).
// Mapping: B.01 -> B1, B -> B2, các biến thể C (C1, C1-Cm, C1-D2, Cm-CE) -> C.
// Fallback: nếu thiếu LoaiKhoaHoc, dùng string-match trên KhoaHoc (có dấu . là B1, không có là B2, có C là C).
function mapCategory(loaiKhoaHoc, khoaHoc) {
  if (loaiKhoaHoc) {
    const loai = loaiKhoaHoc.trim();
    if (loai === "B1" || loai === "B.01" || loai === "B11") return "B1";
    if (loai === "B2" || loai === "B") return "B2";
    if (loai.toUpperCase().startsWith("C")) return "C";
  }
  // Fallback theo tên khóa học (logic mới)
  const kh = khoaHoc || "";
  if (kh.includes("C")) return "C";
  if (kh.includes(".")) return "B1";
  return "B2";
}

module.exports = router;
