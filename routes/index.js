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
const dateDAT = require("../model/dateDAT");
const excel = require("excel4node");

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { layout: "layout" });
});

router.get("/dashboard", function (req, res, next) {
  res.render("dashBoard", { layout: "layout" });
});

router.get("/dateDAT", async function (req, res, next) {
  const data = await dateDAT.find({});
  res.render("dateDAT", { data });
});

router.get("/xml", function (req, res, next) {
  res.render("xml_view", {});
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

  dat_ss.sort((a, b) => {
    return parseInt(a.STT) - parseInt(b.STT);
  });

  res.render("allDat_session", { dat_ss });
});

router.get("/allTotal", async function (req, res, next) {
  const khoahocArray = req.query.khoahoc;

  const kh = await dateDAT.find({});
  const total = await Total.find({});

  if(khoahocArray){
    const selectedKhoaHoc = Array.isArray(khoahocArray) ? khoahocArray : (khoahocArray ? [khoahocArray] : []);
    const total = await Total.find({ KhoaHoc: { $in: selectedKhoaHoc } });
  
    res.render("total", { total, kh, selectedKhoaHoc });
  }else{
    res.render("total", { total, kh});
  }
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
  const ss_check = await Dat_session.find({});
  const tt_check = await Total.find({});

  if (ss_check.length > 0 || tt_check.length > 0) {
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
  }

  const data = req.body;
  const cars = await Car.find({ LoaiHangXe: "B11" });
  const dateDATs = await dateDAT.find({});

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
      hour: 17,
      minute: 59,
      second: 59,
    });
    const ketThucToi = moment(ngayDaoTao).add(thoiGianPhut, "minutes");

    // chia sang toi thoi
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

    const matchingCar = cars.find((car) => car.BienSoXe === item.XeTapLai);
    // Tạo một mảng để lưu trữ các lý do
    const lyDoLoaiList = [];

    //
    const matchingDateDAT = dateDATs.find(
      (dateDAT) => dateDAT.KhoaHoc === item.KhoaHoc
    );

    if (matchingDateDAT) {
      const sessionDate = moment(item.NgayDaoTao, "DD/MM/YY HH:mm");
      const startDate = moment(matchingDateDAT.startDate, "DD/MM/YY");
      const endDate = moment(matchingDateDAT.endDate, "DD/MM/YY").endOf("day"); // End date should be the end of the day

      // Kiểm tra ngày đào tạo nằm trong khoảng từ ngày bắt đầu đến ngày kết thúc
      if (
        !sessionDate.isSameOrAfter(startDate) ||
        !sessionDate.isSameOrBefore(endDate)
      ) {
        lyDoLoaiList.push(
          `Ngoài ngày đào tạo của khoá ${matchingDateDAT.KhoaHoc}`
        );
      }
    }

    if (
      matchingCar &&
      matchingCar.LoaiHangXe === "B11" &&
      ngayDaoTao.isAfter(ketThucSang) &&
      !item.KhoaHoc.includes("B1")
    ) {
      lyDoLoaiList.push("Hạng của bạn không được đi B11 ban đêm");
      item.TrangThai = true;
    }

    // Kiểm tra điều kiện TiLe và ThoiGian
    item["TiLe"] = Math.round(parseFloat(item["TiLe"]));
    const tiLeLessThan75 = parseInt(item["TiLe"]) < 75;
    const durationGreaterThanOrEqualTo4Hours = isDurationGreaterThan4Hours(
      item["ThoiGian"]
    );

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

    // Kết hợp các lý do thành một chuỗi
    const lyDoLoai = lyDoLoaiList.join(", ");

    if (
      matchingCar &&
      matchingCar.LoaiHangXe === "B11" &&
      !item.KhoaHoc.includes("B1")
    ) {
      // Tạo một mục mới của Dat_session với các thông tin và lý do được cập nhật
      const newItem = new Dat_session({
        _id: item["MaPhien"],
        TrangThai:
          tiLeLessThan75 ||
          durationGreaterThanOrEqualTo4Hours ||
          thoiGianPhut <= 5,
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
        TrangThai:
          tiLeLessThan75 ||
          durationGreaterThanOrEqualTo4Hours ||
          thoiGianPhut <= 5,
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

  // for (const [studentId, dateMap] of studentMap.entries()) {
  //   for (const [date, data] of dateMap.entries()) {
  //     if (data.totalDuration > 600 || data.totalDistance > 400) {
  //       const reason = `Ngày ${date} có tổng thời gian hoặc km quá giới hạn / ngày`;

  //       data.sessions.forEach((session) => {
  //         session.TrangThai = true;
  //         session.LyDoLoai = session.LyDoLoai
  //           ? `${session.LyDoLoai}, ${reason}`
  //           : reason;
  //         updates.push(session);
  //       });
  //     }
  //   }
  // }

  for (const [studentId, dateMap] of studentMap.entries()) {
    for (const [date, data] of dateMap.entries()) {
      // Check if the day total duration or distance exceed limits
      if (data.totalDuration > 600 || data.totalDistance > 400) {
        let latestSession = null;
        let latestEndTime = null;

        // Find the latest end time session in the day
        for (const session of data.sessions) {
          const endTime = moment(session.NgayDaoTao, "DD/MM/YY HH:mm"); // Assuming endDateTime in a different format as date and time combined
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
        const startA = moment(a.NgayDaoTao, "DD/MM/YY HH:mm");
        const startB = moment(b.NgayDaoTao, "DD/MM/YY HH:mm");
        return startA - startB;
      });

      // Check for breaks less than 15 minutes between sessions
      for (let i = 0; i < sessions.length - 1; i++) {
        const currentSession = sessions[i];
        const nextSession = sessions[i + 1];

        // Calculate time difference between sessions
        const startCurrent = moment(
          currentSession.NgayDaoTao,
          "DD/MM/YY HH:mm"
        );
        const endCurrent = startCurrent
          .clone()
          .add(parseDuration(currentSession.ThoiGian), "minutes");
        const startNext = moment(nextSession.NgayDaoTao, "DD/MM/YY HH:mm");

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
    const teacher = session.HoTenGiaoVien;
    const date = moment(session.NgayDaoTao, "DD/MM/YY").format("DD/MM/YY");
    const startDateTime = moment(session.NgayDaoTao, "DD/MM/YY HH:mm");
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

  // Lưu vào cơ sở dữ liệu
  try {
    for (const update of updates) {
      await Dat_session.updateOne(
        { _id: update._id },
        { $set: { TrangThai: update.TrangThai, LyDoLoai: update.LyDoLoai } }
      );
    }
    res.redirect("/computeData");
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Internal Server Error");
  }
});

function isOverlapping(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

router.post("/uploadxml", upload.single("file"), (req, res) => {
  const filePath = req.file.path;

  const fileName = path.basename(
    req.file.originalname,
    path.extname(req.file.originalname)
  );
  const parts = fileName.split("_");
  const maKhoaHoc = parts[3]; // Extract the full course code
  const khoaHoc = maKhoaHoc.substring(maKhoaHoc.indexOf("K"));

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
          "Khoá học": khoaHoc,
          "Mã khoá học": maKhoaHoc,
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
      res.redirect("xml");
    } catch (err) {
      console.error("Error saving data:", err);
    }
  });

  res.sendStatus(200);
});

router.get("/computeData", async (req, res) => {
  try {
    const dat_ss = await Dat_session.find({ TrangThai: false });
    const studentMap = new Map();

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
          // KhoaHoc: new Set(),
          XeTapLai: new Set(),
          B1: new Set(),
          B2: new Set(),
          C: new Set(),
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
      // studentData.KhoaHoc.add(col.KhoaHoc);
      studentData.XeTapLai.add(col.XeTapLai);
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

      if (data.totalMorningDistance < 5 && data.totalMorningTime < 30) {
        reasons.push("Chưa đủ điều kiện đi tối");
        studentStatus = true;
      }

      let xeTapLaiList = Array.from(data.XeTapLai);

      for (let bienSoXe of xeTapLaiList) {
        const car = await Car.findOne({ BienSoXe: bienSoXe });
        if (car) {
          if (car.LoaiHangXe === "B11") {
            data.B1.add(bienSoXe);
          } else if (car.LoaiHangXe === "B2") {
            data.B2.add(bienSoXe);
          } else if (car.LoaiHangXe === "C") {
            data.C.add(bienSoXe);
          }
        }
      }

      updatedStudents.push({
        MaHocVien: studentId,
        Anh: student ? student.Anh : "",
        KhoaHoc: student.KhoaHoc,
        MaKhoaHoc: student.MaKhoaHoc,
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
        B1: Array.from(data.B1).join(", "),
        B2: Array.from(data.B2).join(", "),
        C: Array.from(data.C).join(", "),
      });
    }

    await Total.create(updatedStudents);

    const existingTotalStudents = await Total.find();
    const existingTotalHoTenSet = new Set(
      existingTotalStudents.map((student) => student.HoTen)
    );
    const students = await Student.find();

    // Handle students with HoTen in Student model but not in dat_ss
    for (const student of students) {
      let category = "Unknown";

      if (student.KhoaHoc.includes("B1")) {
        category = "B1";
      } else if (student.KhoaHoc.includes("B2")) {
        category = "B2";
      } else if (student.KhoaHoc.includes("C")) {
        category = "C";
      }

      if (!existingTotalHoTenSet.has(student.HoTen)) {
        const newTotal = new Total({
          MaHocVien: student.MaHocVien,
          Anh: student.Anh,
          HoTen: student.HoTen,
          SoCMT: student.SoCMT,
          GioiTinh: student.GioiTinh,
          NgaySinh: student.NgaySinh,
          KhoaHoc: student.KhoaHoc,
          MaKhoaHoc: student.MaKhoaHoc,
          TongThoiGianXeSoTuDong: 0,
          TongQuangDuongXeSoTuDong: "0",
          TotalMorningTime: "0h00",
          TotalEveningTime: "0h00",
          TotalMorningDistance: "0.00",
          TotalEveningDistance: "0.00",
          TotalDuration: "0h00",
          TotalDistance: "0.00",
          Category: category,
          TrangThai: true,
          LyDo: "Chưa chạy chạy phiên",
          B1: "",
          B2: "",
          C: "",
        });
        await newTotal.save();
      }
    }

    res.redirect("allTotal");
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
.string("BÁO CÁO KẾT QUẢ ĐÀO TẠO THỰC HÀNH LÁI XE TRÊN ĐƯỜNG GIAO THÔNG THEO DANH SÁCH THÍ SINH DỰ TỐT NGHIỆP")
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
    const cell = ws.cell(6, index + 1)
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
      ws.cell(rowIndex, 12).string(item["Kết quả"]).style(cellNormalStyle);
      rowIndex++;
      overallIndex++; // Increment global STT counter
    });
  });

  const filename = req.body.filename || "example.xlsx";
  wb.write(filename, res);
});

router.get("/search", async function (req, res, next) {
  const courses = await dateDAT.find({});

  res.render("search", {
    title: "Search",
    query: "",
    results: [],
    sessions: [],
    courses
  });
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

router.get("/studentDetails/:id", async (req, res)=>{
    const id = req.params.id;
    let sessions = [];
    let results = [];

    results = await Total.find({MaHocVien:id});

    if (results.length > 0) {
      const studentIds = results.map((result) => result.MaHocVien);
      sessions = await Dat_session.find({ MaHocVien: { $in: studentIds } });
    }

    res.render("search", {results,sessions});
});

router.get("/filter", async (req,res)=>{
  const { trangthai, khoahoc } = req.query;

  const courses = await dateDAT.find({});
  const tt = await Total.find({ TrangThai: trangthai, KhoaHoc: khoahoc });

  res.render("search", { tt,courses, khoahoc, trangthai });
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

router.get("/updateDate", async (req, res) => {
  const { id } = req.query;
  try {
    const dateRange = await dateDAT.findById(id);
    const data = await dateDAT.find({});

    dateRange.startDate = convertToISODate(dateRange.startDate);
    dateRange.endDate = convertToISODate(dateRange.endDate);

    res.render("updateDate", { dateRange,data });
  } catch (err) {
    console.error("Error fetching date range:", err);
    res.status(500).send("Error fetching date range");
  }
});

router.post("/submitDate", async (req, res) => {
  const { KhoaHoc, startDate, endDate } = req.body;

  // Chuyển đổi ngày sang định dạng DD/MM/YY
  const formatDate = (date) => {
    const d = new Date(date);
    let day = String(d.getDate()).padStart(2, "0");
    let month = String(d.getMonth() + 1).padStart(2, "0");
    let year = String(d.getFullYear()).slice(2);
    return `${day}/${month}/${year}`;
  };

  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = formatDate(endDate);

  const newCourse = new dateDAT({
    KhoaHoc,
    startDate: formattedStartDate,
    endDate: formattedEndDate,
  });
  await newCourse.save();
  res.redirect("/dateDAT");
});

router.post("/updateDate", async (req, res) => {
  const { id, KhoaHoc, startDate, endDate } = req.body;

  // Chuyển đổi ngày sang định dạng DD/MM/YY
  const formatDate = (date) => {
    const d = new Date(date);
    let day = String(d.getDate()).padStart(2, "0");
    let month = String(d.getMonth() + 1).padStart(2, "0");
    let year = String(d.getFullYear()).slice(2);
    return `${day}/${month}/${year}`;
  };

  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = formatDate(endDate);

  try {
    await dateDAT.findByIdAndUpdate(id, {
      KhoaHoc,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
    });
    res.redirect("dateDAT");
  } catch (err) {
    console.error("Error updating date range:", err);
    res.status(500).send("Error updating date range");
  }
});

function convertToISODate(dateStr) {
  const [day, month, year] = dateStr.split('/');
  return `20${year}-${month}-${day}`; // Giả sử năm là 20xx
}

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
