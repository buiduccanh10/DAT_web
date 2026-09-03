const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/DAT_DB', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const db = mongoose.connection.db;
    const cars = await db.collection('cars').find({}).toArray();
    console.log("Types:", [...new Set(cars.map(c => c.LoaiHangXe))]);
    process.exit(0);
  }).catch(e => { console.error(e); process.exit(1); })
