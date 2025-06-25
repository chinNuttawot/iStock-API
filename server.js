const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const { TestAuth, sendNoti, Login } = require("./src/MainApp")
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.listen(port, () => { console.log(`Listening at http://localhost:${port}`); });

// post
app.post("/api/sendnoti", sendNoti)
app.post("/api/login", Login)

//get
app.get("/api/testauth", TestAuth)