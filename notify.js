const admin = require('firebase-admin');

const serviceAccount = require('./sms-link-firebase-adminsdk-n7bov-39b036293a.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://sms-link.firebaseio.com'
});

const payload = {
  data: {
    title: 'test',
    body: 'Hi!!'
  }
};

admin.messaging().sendToDevice('fWkYLgax5K8:APA91bGu9CSyeZKswD_4C7M8lnXFQMFYaB9ZK6l_lyEefTeKNJdL1kfKo7pIgPOC9ZCup1IAAEM0cuI_OzpyAmpdlkBtAY5cLyRwtPS81-4RgmpvhOFiMMv_V7FOgC_F6aZttZ2bP8bY', payload)
  .then(function(response) {
    console.log("Successfully sent message:", response);
  })
  .catch(function(error) {
    console.log("Error sending message:", error);
  });
