const { Expo } = require('expo-server-sdk')
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

const jwtKey = "my_secret_key"
const jwtExpirySeconds = 10
dotenv.config();

const TestAuth = (req, res) => {
    const token = req.headers['authorization']

    if (!token) {
        return res.status(401).json({ message: "ไม่มี token" }).end()
    }
    var payload
    try {
        const bearer = token.split(' ')
        payload = jwt.verify(bearer[1], jwtKey)
    } catch (e) {
        if (e instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ message: "token หมดอายุ" }).end()
        }
        return res.status(400).end()
    }
    res.send(`Welcome ${payload.username}!`)
    res.end()
}

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
            sound: 'default',
            title: title,
            body: body,
            data: { withSome: 'data' },
        })
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
                    if (status === 'ok') {
                        continue;
                    } else if (status === 'error') {
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
}

const Login = (req, res) => {
    const users = {
        user1: "password1",
        user2: "password2",
    }
    const { username, password } = req.body
    if (!username || !password || users[username] !== password) {
        return res.send({ message: "username or password not found." }).end()
    }
    const token = jwt.sign({ username }, jwtKey, {
        algorithm: "HS256",
        expiresIn: jwtExpirySeconds,
    })
    const Datas = {
        username: username,
        time: new Date().toLocaleString('th-TH'),
        timestamp: Date.now(),
        token: token
    }
    res.setHeader('Cookie', token, { maxAge: jwtExpirySeconds * 1000 });
    res.status(200).json(Datas).end()
}


module.exports = {
    Login,
    TestAuth,
    sendNoti
}