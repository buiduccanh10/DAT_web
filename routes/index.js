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
const Total = require("../model/total");
const Car = require("../model/car");

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { layout: "layout" });
});

router.get("/search", async function (req, res, next) {
  // const count_student = await Total.find({});
  // const count_student_pass = await Total.find({ TrangThai: false });
  // const count_student_loss = await Total.find({ TrangThai: true });
  // const count_session = await Dat_session.find({});
  // const count_session_pass = await Dat_session.find({ TrangThai: false });
  // const count_session_loss = await Dat_session.find({ TrangThai: true });

  res.render("search", {
    title: "Search",
    query: "",
    results: [],
    sessions: [],
    // count_student: count_student.length,
    // count_student_pass: count_student_pass.length,
    // count_student_loss: count_student_loss.length,
    // count_session: count_session.length,
    // count_session_pass: count_session_pass.length,
    // count_session_loss: count_session_loss.length,
  });
});

router.get("/xml", function (req, res, next) {
  res.render("xml_view", { title: "Express" });
});

router.get("/car", function (req, res, next) {
  res.render("car", { title: "Car input" });
});

router.get("/allStudent", async function (req, res, next) {
  const student = await Student.find({});

  student.sort((a, b) => {
    return parseInt(a.STT) - parseInt(b.STT);
  });

  res.render("student", { student });
});

router.get("/allDat_session", async function (req, res, next) {
  const dat_ss = await Dat_session.find({});

  // dat_ss.forEach((col) => {
  //   col.TiLe = Math.round(parseFloat(col.TiLe));
  //   const tiLeLessThan90 = parseInt(col.TiLe) < 90;
  //   const durationGreaterThanOrEqualTo4Hours =
  //     isDurationGreaterThan4Hours(col.ThoiGian);
  //   col.TrangThai = tiLeLessThan90 || durationGreaterThanOrEqualTo4Hours;
  // });

  dat_ss.sort((a, b) => {
    return parseInt(a.STT) - parseInt(b.STT);
  });

  res.render("allDat_session", { dat_ss });
});

router.get("/allTotal", async function (req, res, next) {
  const total = await Total.find({});

  res.render("total", { total });
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

// router.post("/upload", upload.single("file"), (req, res) => {
//   const filePath = req.file.path;

//   // Đọc file Excel
//   const workbook = xlsx.readFile(filePath);
//   const sheet = workbook.Sheets[workbook.SheetNames[0]];
//   let data = xlsx.utils.sheet_to_json(sheet);

//   // Chuyển đổi giá trị số thập phân thành ngày tháng
//   data = data.map((row) => {
//     if (row["Ngày đào tạo"] && !isNaN(row["Ngày đào tạo"])) {
//       const excelDate = row["Ngày đào tạo"];
//       const jsDate = new Date((excelDate - 25569) * 86400 * 1000); // Chuyển đổi từ số ngày Excel thành timestamp JavaScript
//       row["Ngày đào tạo"] = moment(jsDate).format("DD/MM/YY HH:mm"); // Định dạng ngày tháng bằng moment
//     }
//     return row;
//   });

//   // Hiển thị dữ liệu
//   res.render("index", { data: data });
// });

router.post("/upload", upload.single("file"), (req, res) => {
  const filePath = req.file.path;

  // Đọc file Excel với tùy chọn cellDates: true
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let data = xlsx.utils.sheet_to_json(sheet);

  data = data.map((row) => {
    if (row["Ngày đào tạo"] instanceof Date) {
      row["Ngày đào tạo"] = moment(row["Ngày đào tạo"]).format(
        "DD/MM/YY HH:mm"
      );
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

  data = data.map((row) => {
    if (row["Biển số"]) {
      row["Biển số"] = row["Biển số"].replace(/[-,.]/g, "");
    }
    return row;
  });

  // Hiển thị dữ liệu
  res.render("car", { data: data });
});

// router.post("/save-dat-session", (req, res) => {
//   const data = req.body;

//   if (!data || data.length === 0) {
//     return res.status(400).send("No data to save");
//   }

//   // dat_ss.forEach((col) => {
//   //   col.TiLe = Math.round(parseFloat(col.TiLe));
//   //   const tiLeLessThan90 = parseInt(col.TiLe) < 90;
//   //   const durationGreaterThanOrEqualTo4Hours =
//   //     isDurationGreaterThan4Hours(col.ThoiGian);
//   //   col.TrangThai = tiLeLessThan90 || durationGreaterThanOrEqualTo4Hours;
//   // });

//   data.forEach(async (item) => {
//     item["TiLe"] = Math.round(parseFloat(item["TiLe"]));
//     const tiLeLessThan90 = parseInt(item["TiLe"]) < 90;
//     const durationGreaterThanOrEqualTo4Hours = isDurationGreaterThan4Hours(
//       item["ThoiGian"]
//     );
//     const TrangThai = tiLeLessThan90 || durationGreaterThanOrEqualTo4Hours;
//     const newItem = new Dat_session({
//       _id: item["MaPhien"],
//       TrangThai: TrangThai,
//       ...item,
//     });

//     try {
//       await newItem.save();
//     } catch (err) {
//       console.error("Error saving data:", err);
//     }
//   });

//   res.sendStatus(200);
// });

// router.post("/save-dat-session", async (req, res) => {
//   const data = req.body;

//   if (!data || data.length === 0) {
//     return res.status(400).send("No data to save");
//   }

//   // Lặp qua từng mục dữ liệu
//   for (let i = 0; i < data.length; i++) {
//     const item = data[i];

//     // Chuyển đổi thời gian từ chuỗi sang phút
//     const thoiGianPhut =
//       parseInt(item.ThoiGian.split("h")[0]) * 60 +
//       parseInt(item.ThoiGian.split("h")[1]);

//     // Tính toán thời gian sáng, thời gian tối, và quãng đường sáng/tối
//     let thoiGianSang = 0;
//     let thoiGianToi = 0;
//     let quangDuongSang = 0;
//     let quangDuongToi = 0;

//     // Kiểm tra xem NgayDaoTao + ThoiGian nằm trong khoảng thời gian sáng hay tối không
//     const ngayDaoTao = moment(item.NgayDaoTao, "DD/MM/YY HH:mm");
//     const ketThucSang = moment(ngayDaoTao).set({
//       hour: 18,
//       minute: 59,
//       second: 59,
//     });
//     const ketThucToi = moment(ngayDaoTao).add(thoiGianPhut, "minutes");

//     if (ngayDaoTao.isAfter(ketThucSang)) {
//       // Toàn bộ thời gian là thời gian tối
//       thoiGianToi = thoiGianPhut;
//       quangDuongToi = parseFloat(item.QuangDuong);
//     } else if (ketThucSang.isBefore(ketThucToi)) {
//       // Thời gian sáng
//       thoiGianSang = ketThucSang.diff(ngayDaoTao, "minutes");
//       quangDuongSang =
//         (parseFloat(item.QuangDuong) * thoiGianSang) / thoiGianPhut;

//       // Thời gian tối
//       thoiGianToi = thoiGianPhut - thoiGianSang;
//       quangDuongToi = parseFloat(item.QuangDuong) - quangDuongSang;
//     } else {
//       // Thời gian toàn bộ là thời gian sáng
//       thoiGianSang = thoiGianPhut;
//       quangDuongSang = parseFloat(item.QuangDuong);
//     }

//     // Thêm thông tin tính toán vào mục dữ liệu
//     item.TotalMorningTime = thoiGianSang;
//     item.TotalEveningTime = thoiGianToi;
//     item.TotalMorningDistance = quangDuongSang;
//     item.TotalEveningDistance = quangDuongToi;

//     // Kiểm tra điều kiện TiLe và ThoiGian
//     item["TiLe"] = Math.round(parseFloat(item["TiLe"]));
//     const tiLeLessThan90 = parseInt(item["TiLe"]) < 90;
//     const durationGreaterThanOrEqualTo4Hours = isDurationGreaterThan4Hours(
//       item["ThoiGian"]
//     );

//     // Tạo một mảng để lưu trữ các lý do
//     const lyDoLoaiList = [];

//     // Kiểm tra các điều kiện và thêm lý do vào mảng
//     if (tiLeLessThan90) {
//       lyDoLoaiList.push("Tỉ lệ dưới 90");
//     }
//     if (durationGreaterThanOrEqualTo4Hours) {
//       lyDoLoaiList.push("Thời gian quá 4h một ngày");
//     }

//     // Kết hợp các lý do thành một chuỗi
//     const lyDoLoai = lyDoLoaiList.join(", ");

//     // Tạo một mục mới của Dat_session với các thông tin và lý do được cập nhật
//     const newItem = new Dat_session({
//       _id: item["MaPhien"],
//       TrangThai: tiLeLessThan90 || durationGreaterThanOrEqualTo4Hours,
//       LyDoLoai: lyDoLoai,
//       ...item,
//     });

//     // Lưu vào cơ sở dữ liệu
//     try {
//       await newItem.save();
//     } catch (err) {
//       console.error("Error saving data:", err);
//     }
//   }

//   res.sendStatus(200);
// });

router.post("/save-car", async (req, res) => {
  const carsData = req.body;

  try {
    await Car.insertMany(carsData);
    res.status(200).send("Data saved successfully!");
  } catch (error) {
    res.status(500).send("Error saving data: " + error.message);
  }
});

router.post("/save-dat-session", async (req, res) => {
  const data = req.body;
  const cars = await Car.find({ LoaiHangXe: "B11" });

  if (!data || data.length === 0) {
    return res.status(400).send("No data to save");
  }

  // Lưu tạm thời tất cả các phiên học
  const sessions = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    // Chuyển đổi thời gian từ chuỗi sang phút
    const thoiGianPhut =
      parseInt(item.ThoiGian.split("h")[0]) * 60 +
      parseInt(item.ThoiGian.split("h")[1]);

    // Tính toán thời gian sáng, thời gian tối, và quãng đường sáng/tối
    let thoiGianSang = 0;
    let thoiGianToi = 0;
    let quangDuongSang = 0;
    let quangDuongToi = 0;

    // Kiểm tra xem NgayDaoTao + ThoiGian nằm trong khoảng thời gian sáng hay tối không
    const ngayDaoTao = moment(item.NgayDaoTao, "DD/MM/YY HH:mm");
    const ketThucSang = moment(ngayDaoTao).set({
      hour: 18,
      minute: 59,
      second: 59,
    });
    const ketThucToi = moment(ngayDaoTao).add(thoiGianPhut, "minutes");

    if (ngayDaoTao.isAfter(ketThucSang)) {
      // Toàn bộ thời gian là thời gian tối
      thoiGianToi = thoiGianPhut;
      quangDuongToi = parseFloat(item.QuangDuong);
    } else if (ketThucSang.isBefore(ketThucToi)) {
      // Thời gian sáng
      thoiGianSang = ketThucSang.diff(ngayDaoTao, "minutes");
      quangDuongSang =
        (parseFloat(item.QuangDuong) * thoiGianSang) / thoiGianPhut;

      // Thời gian tối
      thoiGianToi = thoiGianPhut - thoiGianSang;
      quangDuongToi = parseFloat(item.QuangDuong) - quangDuongSang;
    } else {
      // Thời gian toàn bộ là thời gian sáng
      thoiGianSang = thoiGianPhut;
      quangDuongSang = parseFloat(item.QuangDuong);
    }

    // Thêm thông tin tính toán vào mục dữ liệu
    item.TotalMorningTime = thoiGianSang;
    item.TotalEveningTime = thoiGianToi;
    item.TotalMorningDistance = quangDuongSang.toFixed(2);
    item.TotalEveningDistance = quangDuongToi.toFixed(2);

    // Kiểm tra điều kiện TiLe và ThoiGian
    item["TiLe"] = Math.round(parseFloat(item["TiLe"]));
    const tiLeLessThan90 = parseInt(item["TiLe"]) < 90;
    const durationGreaterThanOrEqualTo4Hours = isDurationGreaterThan4Hours(
      item["ThoiGian"]
    );

    // Tạo một mảng để lưu trữ các lý do
    const lyDoLoaiList = [];

    // Kiểm tra các điều kiện và thêm lý do vào mảng
    if (tiLeLessThan90) {
      lyDoLoaiList.push("Tỉ lệ dưới 90");
    }
    if (durationGreaterThanOrEqualTo4Hours) {
      lyDoLoaiList.push("Thời gian quá 4h một ngày");
    }

    // Kết hợp các lý do thành một chuỗi
    const lyDoLoai = lyDoLoaiList.join(", ");

    const matchingCar = cars.find((car) => car.BienSoXe === item.XeTapLai);

    if (
      matchingCar &&
      matchingCar.LoaiHangXe === "B11" &&
      !item.KhoaHoc.includes("B1")
    ) {
      // Tạo một mục mới của Dat_session với các thông tin và lý do được cập nhật
      const newItem = new Dat_session({
        _id: item["MaPhien"],
        TrangThai: tiLeLessThan90 || durationGreaterThanOrEqualTo4Hours,
        LyDoLoai: lyDoLoai,
        ThoiGianXeTuDong: thoiGianPhut,
        QuangDuongXeTuDong: parseFloat(item.QuangDuong),
        ...item,
      });

      // Lưu vào cơ sở dữ liệu
      try {
        await newItem.save();
        sessions.push(newItem);
      } catch (err) {
        console.error("Error saving data:", err);
      }
    } else {
      // Tạo một mục mới của Dat_session với các thông tin và lý do được cập nhật
      const newItem = new Dat_session({
        _id: item["MaPhien"],
        TrangThai: tiLeLessThan90 || durationGreaterThanOrEqualTo4Hours,
        LyDoLoai: lyDoLoai,
        ThoiGianXeTuDong: 0,
        QuangDuongXeTuDong: 0,
        ...item,
      });

      // Lưu vào cơ sở dữ liệu
      try {
        await newItem.save();
        sessions.push(newItem);
      } catch (err) {
        console.error("Error saving data:", err);
      }
    }
  }

  // Gom nhóm các phiên học theo học viên và ngày
  const studentMap = new Map();

  sessions.forEach((session) => {
    const studentId = session.MaHocVien;
    const date = moment(session.NgayDaoTao, "DD/MM/YY HH:mm").format(
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
      if (data.totalDuration > 600 || data.totalDistance > 400) {
        const reason = `Ngày ${date} có tổng thời gian hoặc km quá giới hạn / ngày`;

        data.sessions.forEach((session) => {
          session.TrangThai = true;
          session.LyDoLoai = session.LyDoLoai
            ? `${session.LyDoLoai}, ${reason}`
            : reason;
          updates.push(session);
        });
      }
    }
  }

  // const teacherMap = new Map();

  // sessions.forEach((session) => {
  //   const dateTime = moment(session.NgayDaoTao, "DD/MM/YY HH:mm").format(
  //     "DD/MM/YY HH:mm"
  //   );
  //   const teacher = session.HoTenGiaoVien;

  //   if (!teacherMap.has(dateTime)) {
  //     teacherMap.set(dateTime, new Map());
  //   }

  //   const dateTimeMap = teacherMap.get(dateTime);

  //   if (!dateTimeMap.has(teacher)) {
  //     dateTimeMap.set(teacher, []);
  //   }

  //   dateTimeMap.get(teacher).push(session);
  // });

  // // Kiểm tra gian lận trùng thầy giáo
  // for (const [dateTime, teacherSessionsMap] of teacherMap.entries()) {
  //   for (const [teacher, teacherSessions] of teacherSessionsMap.entries()) {
  //     if (teacherSessions.length > 1) {
  //       const reason = `Trùng thầy giáo`;

  //       teacherSessions.forEach((session) => {
  //         session.TrangThai = true;
  //         session.LyDoLoai = session.LyDoLoai
  //           ? `${session.LyDoLoai}, ${reason}`
  //           : reason;
  //         updates.push(session);
  //       });
  //     }
  //   }
  // }

  const teacherMap = new Map();

  // Group sessions by teacher and date
  sessions.forEach((session) => {
    const teacher = session.HoTenGiaoVien;
    const date = moment(session.NgayDaoTao, "DD/MM/YY").format("DD/MM/YY");
    const startDateTime = moment(session.NgayDaoTao, "DD/MM/YY HH:mm");
    const endDateTime = startDateTime.clone().add(parseDuration(session.ThoiGian), 'minutes');

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
            const reason = "Giáo viên có phiên trùng lặp";

            if (!session1.session.TrangThai) {
              session1.session.TrangThai = true;
              session1.session.LyDoLoai = reason;
              updates.push(session1.session);
            } else if (!session1.session.LyDoLoai.includes(reason)) {
              session1.session.LyDoLoai += `, ${reason}`;
              updates.push(session1.session);
            }

            if (!session2.session.TrangThai) {
              session2.session.TrangThai = true;
              session2.session.LyDoLoai = reason;
              updates.push(session2.session);
            } else if (!session2.session.LyDoLoai.includes(reason)) {
              session2.session.LyDoLoai += `, ${reason}`;
              updates.push(session2.session);
            }
          }
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
    res.sendStatus(200);
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Internal Server Error");
  }
});

function isOverlapping(start1, end1, start2, end2) {
  return (start1 < end2 && start2 < end1);
}

router.post("/uploadxml", upload.single("file"), (req, res) => {
  const filePath = req.file.path;

  // Read and parse the XML file
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Error reading file");
    }

    xml2js.parseString(data, (err, result) => {
      if (err) {
        return res.status(500).send("Error parsing XML");
      }

      // Assuming the XML structure, convert it to a usable format
      const dataFromXml = result.BAO_CAO1.DATA[0].NGUOI_LXS[0].NGUOI_LX.map(
        (lx) => ({
          STT: lx.SO_TT[0],
          "Mã Học Viên": lx.MA_DK[0],
          "Họ Tên": lx.HO_VA_TEN[0],
          "Ngày Sinh": formatDate(lx.NGAY_SINH[0]),
          "Giới Tính": formatGender(lx.GIOI_TINH[0]),
          "Số CMT": lx.SO_CMT[0],
          "Ngày Cấp CMT": lx.NGAY_CAP_CMT[0],
          "Nơi Cấp CMT": lx.NOI_CAP_CMT[0],
          "Ngày Nhận Hồ Sơ": lx.HO_SO[0].NGAY_NHAN_HOSO[0],
          "Số GPLX": lx.SO_GPLX_DA_CO ? lx.SO_GPLX_DA_CO[0] : "",
          "Hạng GPLX": lx.HANG_GPLX_DA_CO ? lx.HANG_GPLX_DA_CO[0] : "",
          "Nơi Cấp GPLX": lx.DV_CAP_GPLX_DACO ? lx.DV_CAP_GPLX_DACO[0] : "",
          Ảnh: lx.HO_SO[0].ANH_CHAN_DUNG[0], // Assuming this field contains the URL of the image
        })
      );

      // console.log(dataFromXml);

      // Render the data in a table
      res.render("xml_view", { data: dataFromXml });
    });
  });
});

router.post("/save-data", (req, res) => {
  const data = req.body;

  if (!data || data.length === 0) {
    return res.status(400).send("No data to save");
  }

  data.forEach(async (item) => {
    const newItem = new Student({
      _id: item["MaHocVien"],
      ...item,
    });

    try {
      await newItem.save();
    } catch (err) {
      console.error("Error saving data:", err);
    }
  });

  res.sendStatus(200);
});

// router.get("/computeData", async (req, res) => {
//   const dat_ss = await Dat_session.find({ TrangThai: false });
//   const studentMap = new Map();

//   dat_ss.forEach((col) => {
//     // const roundedTiLe = Math.round(parseFloat(col.TiLe));
//     // const durationGreaterThanOrEqualTo4Hours = isDurationGreaterThan4Hours(
//     //   col.ThoiGian
//     // );
//     // col.TrangThai = roundedTiLe < 90 || durationGreaterThanOrEqualTo4Hours;

//     const studentId = col.MaHocVien;
//     const sessionTime = parseDuration(col.ThoiGian);
//     const sessionDistance = col.QuangDuong;

//     if (!studentMap.has(studentId)) {
//       studentMap.set(studentId, {
//         totalMorningTime: 0,
//         totalEveningTime: 0,
//         totalMorningDistance: 0,
//         totalEveningDistance: 0,
//         totalDuration: 0,
//         totalDistance: 0,
//         sessions: [],
//       });
//     }

//     const studentData = studentMap.get(studentId);
//     const sessionStartTime = new Date(col.NgayDaoTao);
//     const sessionEndTime = new Date(
//       sessionStartTime.getTime() + sessionTime * 60 * 1000
//     );

//     if (sessionStartTime.getHours() >= 7 && sessionStartTime.getHours() < 19) {
//       studentData.totalEveningTime += sessionTime;
//       studentData.totalEveningDistance += sessionDistance;
//     } else {
//       studentData.totalMorningTime += sessionTime;
//       studentData.totalMorningDistance += sessionDistance;
//     }

//     studentData.totalDuration += sessionTime;
//     studentData.totalDistance += sessionDistance;
//     studentData.sessions.push(col);
//   });

//   const updatedStudents = [];

//   for (const [studentId, data] of studentMap.entries()) {
//     // const student = await Student.findById({ _id: studentId });

//     const studentSessions = data.sessions;
//     let category = "Unknown";
//     studentSessions.forEach((session) => {
//       if (session.KhoaHoc.includes("B1")) {
//         category = "B1";
//       } else if (session.KhoaHoc.includes("B2")) {
//         category = "B2";
//       } else if (session.KhoaHoc.includes("C")) {
//         category = "C";
//       }
//     });

//     let studentStatus = false;

//     if (category === "B1") {
//       studentStatus =
//         data.totalDuration < 12 ||
//         data.totalDistance < 710 ||
//         data.totalEveningTime < 4 ||
//         data.totalEveningDistance < 110;
//     } else if (category === "B2") {
//       studentStatus =
//         data.totalDuration < 20 ||
//         data.totalDistance < 810 ||
//         data.totalEveningTime < 4 ||
//         data.totalEveningDistance < 140;
//     } else if (category === "C") {
//       studentStatus =
//         data.totalDuration < 24 ||
//         data.totalDistance < 825 ||
//         data.totalEveningTime < 2.5 ||
//         data.totalEveningDistance < 70;
//     }

//     updatedStudents.push({
//       // Anh: student.Anh,
//       MaHocVien: studentId,
//       // HoTen: student.HoTen,
//       // NgaySinh: student.NgaySinh,
//       // GioiTinh: student.GioiTinh,
//       TotalMorningTime: formatTime(data.totalMorningTime),
//       TotalEveningTime: formatTime(data.totalEveningTime),
//       TotalMorningDistance: data.totalMorningDistance,
//       TotalEveningDistance: data.totalEveningDistance,
//       TotalDuration: formatTime(data.totalDuration),
//       TotalDistance: data.totalDistance,
//       Category: category,
//       TrangThai: studentStatus,
//     });
//   }

//   // console.log(updatedStudents);

//   await Total.create(updatedStudents);

//   // await StudentSession.bulkWrite(
//   //   updatedStudents.map((student) => ({
//   //     updateOne: {
//   //       filter: { MaHocVien: student.MaHocVien },
//   //       update: {
//   //         $set: {
//   //           TotalMorningTime: student.TotalMorningTime,
//   //           TotalEveningTime: student.TotalEveningTime,
//   //           TotalMorningDistance: student.TotalMorningDistance,
//   //           TotalEveningDistance: student.TotalEveningDistance,
//   //           TotalDuration: student.TotalDuration,
//   //           TotalDistance: student.TotalDistance,
//   //           Category: student.Category,
//   //           TrangThai: student.TrangThai,
//   //         },
//   //       },
//   //     },
//   //   }))
//   // );

//   res.json({ message: "Data computed and saved successfully" });
// });

router.get("/computeData", async (req, res) => {
  try {
    const dat_ss = await Dat_session.find({ TrangThai: false });
    const studentMap = new Map();

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
        });
      }

      const studentData = studentMap.get(studentId);

      studentData.totalMorningTime += col.TotalMorningTime;
      studentData.totalEveningTime += col.TotalEveningTime;

      studentData.TongThoiGianB11 += col.ThoiGianXeTuDong;
      studentData.TongQuangDuongB11 += col.QuangDuongXeTuDong;

      studentData.totalMorningDistance += col.TotalMorningDistance;
      studentData.totalEveningDistance += col.TotalEveningDistance;

      studentData.totalDuration += col.TotalMorningTime + col.TotalEveningTime;
      studentData.totalDistance +=
        col.TotalMorningDistance + col.TotalEveningDistance;

      studentData.sessions.push(col);
    });

    const updatedStudents = [];

    for (const [studentId, data] of studentMap.entries()) {
      const student = await Student.findById(studentId);

      const studentSessions = data.sessions;
      let category = "Unknown";
      let reasons = [];

      studentSessions.forEach((session) => {
        if (session.KhoaHoc.includes("B1")) {
          category = "B1";
        } else if (session.KhoaHoc.includes("B2")) {
          category = "B2";
        } else if (session.KhoaHoc.includes("C")) {
          category = "C";
        }
      });

      let studentStatus = false;

      if (category === "B1") {
        if (data.totalDuration < 720) reasons.push("Thời gian chưa đạt 12 giờ");
        if (data.totalDistance < 710)
          reasons.push("Quãng đường chưa đạt 710km");
        if (data.totalEveningTime < 240)
          reasons.push("Thời gian tối chưa đạt 4 giờ");
        if (data.totalEveningDistance < 110)
          reasons.push("Quãng đường tối chưa đạt 110km");
        studentStatus = reasons.length > 0;
      } else if (category === "B2") {
        if (data.TongThoiGianB11 < 192)
          reasons.push("Chưa đi đủ thời gian B11");
        if (data.TongQuangDuongB11 < 110)
          reasons.push("Chưa đi đủ quãng đường B11");
        if (data.totalDuration < 1200)
          reasons.push("Thời gian chưa đạt 20 giờ");
        if (data.totalDistance < 810)
          reasons.push("Quãng đường chưa đạt 810km");
        if (data.totalEveningTime < 240)
          reasons.push("Thời gian tối chưa đạt 4 giờ");
        if (data.totalEveningDistance < 140)
          reasons.push("Quãng đường tối chưa đạt 140km");
        studentStatus = reasons.length > 0;
      } else if (category === "C") {
        if (data.TongThoiGianB11 < 60) reasons.push("Chưa đi đủ thời gian B11");
        if (data.TongQuangDuongB11 < 30)
          reasons.push("Chưa đi đủ quãng đường B11");
        if (data.totalDuration < 1440)
          reasons.push("Thời gian chưa đạt 24 giờ");
        if (data.totalDistance < 825)
          reasons.push("Quãng đường chưa đạt 825km");
        if (data.totalEveningTime < 150)
          reasons.push("Thời gian tối chưa đạt 2.5 giờ");
        if (data.totalEveningDistance < 70)
          reasons.push("Quãng đường tối chưa đạt 70km");
        studentStatus = reasons.length > 0;
      }

      if (data.totalMorningDistance < 100 && data.totalMorningTime < 180) {
        reasons.push("Chưa đủ điều kiện đi tối");
        studentStatus = true;
      }

      updatedStudents.push({
        MaHocVien: studentId,
        Anh: student ? student.Anh : "",
        HoTen: student ? student.HoTen : "",
        NgaySinh: student ? student.NgaySinh : "",
        GioiTinh: student ? student.GioiTinh : "",
        SoCMT: student ? student.SoCMT : "",
        TongThoiGianXeSoTuDong: formatTime(data.TongThoiGianB11),
        TongQuangDuongXeSoTuDong: data.TongQuangDuongB11.toFixed(2),
        TotalMorningTime: formatTime(data.totalMorningTime),
        TotalEveningTime: formatTime(data.totalEveningTime),
        TotalMorningDistance: data.totalMorningDistance.toFixed(2),
        TotalEveningDistance: data.totalEveningDistance.toFixed(2),
        TotalDuration: formatTime(data.totalDuration),
        TotalDistance: data.totalDistance.toFixed(2),
        Category: category,
        TrangThai: studentStatus,
        LyDo: reasons.join(", "),
      });
    }

    await Total.create(updatedStudents);

    res.redirect("allTotal");
  } catch (err) {
    console.error("Error computing data:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/search/results", async (req, res) => {
  try {
    const { query } = req.query; // Lấy giá trị query từ URL

    let results = [];
    let sessions = [];
    if (query) {
      // Nếu có query, thực hiện tìm kiếm trong model Total
      results = await Total.find({
        $or: [
          { HoTen: { $regex: query, $options: "i" } }, // Tìm kiếm mềm theo HoTen
          { SoCMT: query }, // Tìm kiếm chính xác theo SoCMT
          { MaHocVien: query },
        ],
      });

      // Nếu tìm thấy kết quả trong model Total, tìm các phiên liên quan trong model Dat_session
      if (results.length > 0) {
        const studentIds = results.map((result) => result.MaHocVien);
        sessions = await Dat_session.find({ MaHocVien: { $in: studentIds } });
      }
    }

    // Render template và truyền dữ liệu kết quả vào
    res.render("search", { title: "Search", query, results, sessions });
  } catch (error) {
    console.error("Error searching:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/reset", (req, res) => {
  res.render("reset_confirmation", { title: "Xác nhận reset" });
});

// POST endpoint để xử lý reset
router.post("/reset", async (req, res) => {
  try {
    // Xóa dữ liệu trong các model Total và Dat_session
    await Total.deleteMany({});
    await Dat_session.deleteMany({});

    // Xóa tất cả các file trong thư mục /uploads
    const uploadDir = path.join(__dirname, "..", "uploads");
    fs.readdir(uploadDir, (err, files) => {
      if (err) throw err;

      for (const file of files) {
        fs.unlink(path.join(uploadDir, file), (err) => {
          if (err) throw err;
        });
      }
    });

    res.send("Reset thành công");
  } catch (error) {
    console.error("Lỗi khi thực hiện reset:", error);
    res.status(500).send("Đã xảy ra lỗi khi thực hiện reset");
  }
});

function parseDuration(duration) {
  const [hours, minutes] = duration.split("h").map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins < 10 ? "0" : ""}${mins}`;
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
  const [hours, minutes] = duration.split("h").map(Number);
  return hours * 60 + minutes >= 240; // 4 hours in minutes
};

module.exports = router;
