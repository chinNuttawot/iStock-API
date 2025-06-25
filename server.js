const express = require("express");
const app = express();
const port = process.env.PORT || 188;
const { TestAuth, sendNoti, Login, Logout } = require("./Service/MainApp");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});

// post
app.post("/api/sendnoti", sendNoti);
app.post("/api/login", Login);
app.post("/api/logout", Logout);

//get
app.get("/api/testAuth", TestAuth);
