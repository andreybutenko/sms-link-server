const MongoClient = require('mongodb').MongoClient;
const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');
const md5 = require('md5');
const admin = require('firebase-admin');

const syncModule = require('./modules/syncModule.js');

const serviceAccount = require('./sms-link-firebase-adminsdk.json');
const mongoUrl = 'mongodb://localhost:27017/smslink';

const app = http.createServer(handler);
const io = socketio(app);
let db;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://sms-link.firebaseio.com'
});

app.listen(80);

MongoClient.connect(mongoUrl, (err, mongoDb) => {
  if(!err) {
    db = mongoDb;
    console.log("Connected correctly to server");
  }
});

function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}

io.on('connection', function (socket) {
  let user = { signedIn: false };

  const wrap = (cb, data) => {
    return cb(data, user, db, socket);
  }

  socket.on('AUTH', token => {
    console.log('trying to authenticate with token...');
    admin.auth()
      .verifyIdToken(token)
      .then(res => {
        console.log('Signed in successfully!');
        user = {
          signedIn: true,
          name: res.name,
          picture: res.picture,
          _id: res.user_id,
          userId: res.user_id,
          email: res.email,
          emailVerified: res.email_verified,
          signInProvider: res.firebase.sign_in_provider
        }
        console.log(JSON.stringify(user, null, 2))
        db.collection('users')
          .findOneAndUpdate(
            { _id: user._id },
            { $setOnInsert: user },
            { upsert: true, returnOriginal: false },
            (err, res) => {
              if(!err) {
                console.log('Saved user successfully')
              }
              else {
                console.log(JSON.stringify(err, null, 2));
              }
            })
      }, err => {
        console.log(JSON.stringify(err, null, 2));
      }
    );
  });

  socket.on('MESSAGE', function (data) {
    console.log(JSON.stringify(data, null, 2));
  });

  socket.on('MMS', data => wrap(syncModule.onReceiveMms, data));

  socket.on('SMS', data => wrap(syncModule.onReceiveSms, data));

  socket.on('CONTACT', data => wrap(syncModule.onReceiveContact, data));
});