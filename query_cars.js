const mongoose = require('mongoose');
const Car = require('./model/car');

mongoose.connect('mongodb://localhost:27017/DAT_DB', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const cars = await Car.find({});
    const types = [...new Set(cars.map(c => c.LoaiHangXe))];
    console.log("Unique LoaiHangXe values:", types);
    const B11cars = cars.filter(c => c.LoaiHangXe && c.LoaiHangXe.toLowerCase().includes('b1'));
    console.log("B1/B11 cars:", B11cars.map(c => c.LoaiHangXe));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
