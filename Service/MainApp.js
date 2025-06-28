const { Expo } = require("expo-server-sdk");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

const jwtKey = "my_secret_key";
const revokedTokens = new Set();
dotenv.config();

const TestAuth = (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "ไม่มี token" });
  }

  // 🛑 เช็คว่า token เคยถูก revoke หรือยัง
  if (revokedTokens.has(token)) {
    return res.status(401).json({ message: "token นี้ถูกยกเลิกแล้ว (logout)" });
  }

  try {
    const payload = jwt.verify(token, jwtKey);
    res.status(200).json({ message: `ยินดีต้อนรับ ${payload.username}` });
  } catch (e) {
    return res.status(401).json({ message: "token ไม่ถูกต้อง หรือหมดอายุ" });
  }
};

const sendNoti = (req, res) => {
  const { to, title, body } = req.body;
  let expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
  let messages = [];
  for (let pushToken of [to]) {
    // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

    // Check that all your push tokens appear to be valid Expo push tokens
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }

    // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
    messages.push({
      to: pushToken,
      sound: "default",
      title: title,
      body: body,
      data: { withSome: "data" },
    });
  }

  let chunks = expo.chunkPushNotifications(messages);
  let tickets = [];
  (async () => {
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log(ticketChunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }
  })();
  let receiptIds = [];
  for (let ticket of tickets) {
    if (ticket.id) {
      receiptIds.push(ticket.id);
    }
  }

  let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  (async () => {
    for (let chunk of receiptIdChunks) {
      try {
        let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        console.log(receipts);
        for (let receiptId in receipts) {
          let { status, message, details } = receipts[receiptId];
          if (status === "ok") {
            continue;
          } else if (status === "error") {
            console.error(
              `There was an error sending a notification: ${message}`
            );
            if (details && details.error) {
              console.error(`The error code is ${details.error}`);
            }
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  })();
};

const Login = (req, res) => {
  const users = {
    user1: "cGFzc3dvcmQx", //password1
    user2: "cGFzc3dvcmQy", //password2,
  };

  const { username, password } = req.body;
  // const encoded = Buffer.from(message, 'utf8').toString('base64');
  const input_password = Buffer.from(password, "base64").toString("utf8");
  const db_password = Buffer.from(users[username], "base64").toString("utf8");
  if (!username || !password || db_password !== input_password) {
    res.status(401).send({ message: "username or password not found." }).end();
    return;
  }
  const token = jwt.sign({ username }, jwtKey, {
    algorithm: "HS256",
  });
  const Datas = {
    username: username,
    time: new Date().toLocaleString("th-TH"),
    timestamp: Date.now(),
    token: token,
  };
  res.status(200).json(Datas).end();
};

const Logout = (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (token) {
    revokedTokens.add(token);
  }
  res.status(200).json({ message: "Logged out and token revoked." });
};
module.exports = {
  Login,
  TestAuth,
  sendNoti,
  Logout,
};
