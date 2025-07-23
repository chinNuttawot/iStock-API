const express = require("express");
const { Login } = require("./Service/Login");
const { Logout } = require("./Service/Logout");
const { Register } = require("./Service/Register");
const { checkToken } = require("./middleware/checkToken");
const { GetProfile } = require("./Service/Profile");

require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});

// post
app.post("/api/login", Login);
app.post("/api/logout", checkToken, Logout);
app.post("/api/register", Register);


// get
app.get("/api/profile", checkToken, GetProfile);