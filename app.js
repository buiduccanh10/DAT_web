var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var mongoose = require("mongoose");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

var app = express();

var uri = "mongodb://my-mongodb-container:27017/DAT_web";
// var uri = "mongodb://localhost:27017/DAT_web"

mongoose
  .connect(uri)
  .then(() => console.log("Connect db success"))
  .catch((error) => console.log(error));

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

app.use(logger("dev"));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: false, limit: "100mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

var hbs = require("hbs");

//'extractFilename'
hbs.registerHelper("eq", function(v1, v2) {
  return v1 === v2;
});

hbs.registerHelper('checkbox', function (v1, v2) {
  if (Array.isArray(v2)) {
      return v2.includes(v1);
  }
  return v1 === v2;
});

app.use("/", indexRouter);
app.use("/users", usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

const port = process.env.PORT || 4000;
app.listen(port, '0.0.0.0',() => {
  console.log(`App listening on port ${port}`);
});

module.exports = app;
