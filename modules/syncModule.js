const uuidv4 = require('uuid/v4');
const fs = require('fs');

const authModule = require('./authModule.js');

function cleanPhoneNumber(phoneNumber) {
  if(!phoneNumber) return phoneNumber;

  const filters = [
    ['+', ''],
    ['-', ''],
    [' ', ''],
    ['(', ''],
    [')', '']
  ];

  filters.forEach(filter => {
    while(phoneNumber.indexOf(filter[0]) > -1) {
      phoneNumber = phoneNumber.replace(filter[0], filter[1]);
    }
  });

  if(phoneNumber.charAt(0) === '1') {
    phoneNumber = phoneNumber.substring(1); // standardize: remove area code
  }

  return phoneNumber;
}

const onReceiveConversation = (data, user, db, socket) => {
  if(!authModule.assureSignedIn(user, socket)) return;
  console.log('Got a conversation!');

  const conversation = {
    userId: user.userId,
    threadId: parseInt(data._id),
    recipientIds: data.recipient_ids.split(' ').map(recipient => parseInt(recipient)),
    other: data
  };

  console.log(conversation);

  db.collection('conversations')
    .findOneAndUpdate(
      { threadId: conversation.threadId, userId: conversation.userId },
      { $setOnInsert: conversation },
      { upsert: true },
      (err, res) => {
        if(!err) {
          console.log('Saved conversation successfully');
        }
        else {
          console.log('Error while saving conversation');
          console.log(JSON.stringify(err, null, 2));
        }
      }
    );
}

const onReceiveContactRecipientId = (data, user, db, socket) => {
  if(!authModule.assureSignedIn(user, socket)) return;
  console.log('Got a contact recipient id!');

  db.collection('contacts')
    .update(
        {
          userId: user.userId,
          phones: cleanPhoneNumber(data.address)
        }, {
          $set: {
            clientId: parseInt(data._id)
          }
        },
        (err, res) => {
          if(!err)  {
            console.log('Updated contact with recipient id successfully');
          }
          else {
            console.log('Error while updating contact with recipient id');
            console.log(JSON.stringify(err, null, 2));
          }
        }
    );
}

const onReceiveMms = (data, user, db, socket) => {
  if(!authModule.assureSignedIn(user, socket)) return;
  console.log('Got a mms!');

  const text = {
    userId: user.userId,
    clientId: -1,
    threadId: parseInt(data.message.thread_id),
    phone: cleanPhoneNumber(data.address),
    date: new Date(parseInt(data.message.date * 1000)),
    dateSent: new Date(parseInt(data.message.date_sent * 1000)),
    type: parseInt(data.message.msg_box),
    mine: parseInt(data.message.msg_box) >= 2
  }

  for(let i = 0; i < data.parts.length; i++) {
    const part = data.parts[i];

    if(part.ct === 'image/jpeg') {
      let fileName = uuidv4();;
      let uri = './images/' + fileName + '.png';
      fs.writeFile(uri, part.image, { encoding: 'base64', flag: 'w+' }, function(err) {
        if(!err) {
          console.log('Wrote MMS photo successfully')
        }
        else {
          console.log('Error while writing MMS photo');
          console.log(err);
        }
      });

      if(text.hasOwnProperty('images')) {
        text.images.push({
          file: fileName,
          name: part.name
        });
      }
      else {
        text.images = [{
          file: fileName,
          name: part.name
        }]
      }
    }
    else if(part.ct === 'text/plain') {
      if(text.hasOwnProperty('body')) {
        text.content += '\n' + part.body;
      }
      else {
        text.content = part.body
      }
    }
  }

  console.log('MMS')

  db.collection('texts')
    .insertOne(text, (err, res) => {
      if(!err) {
        console.log('Saved MMS successfully')
      }
      else {
        console.log('Error saving MMS');
        console.log(JSON.stringify(err, null, 2));
      }
    });

  const conversation = {
    threadId: text.threadId,
    userId: user.userId
  }

  db.collection('conversations')
    .findOneAndUpdate(
      { threadId: text.threadId, userId: user.userId },
      { $setOnInsert: conversation },
      { upsert: true },
      (err, res) => {
        if(!err) {
          console.log('Saved conversation successfully');
        }
        else {
          console.log('Error while saving conversation');
          console.log(JSON.stringify(err, null, 2));
        }
      }
    );
}

const onReceiveSms = (data, user, db, socket) => {
  if(!authModule.assureSignedIn(user, socket)) return;
  console.log('Got a sms!');

  const text = {
    userId: user.userId,
    clientId: parseInt(data._id),
    threadId: parseInt(data.thread_id),
    phone: cleanPhoneNumber(data.address),
    date: new Date(parseInt(data.date)),
    dateSent: new Date(parseInt(data.date_sent)),
    type: parseInt(data.type),
    mine: parseInt(data.type) >= 2,
    content: data.body
  }

  console.log('SMS')

  db.collection('texts')
    .insertOne(text, (err, res) => {
      if(!err) {
        console.log('Saved SMS successfully')
      }
      else {
        console.log('Error saving SMS');
        console.log(JSON.stringify(err, null, 2));
      }
    });

  const conversation = {
    threadId: text.threadId,
    userId: user.userId
  }

  db.collection('conversations')
    .findOneAndUpdate(
      { threadId: text.threadId, userId: user.userId },
      { $setOnInsert: conversation },
      { upsert: true },
      (err, res) => {
        if(!err) {
          console.log('Saved conversation successfully');
        }
        else {
          console.log('Error while saving conversation');
          console.log(JSON.stringify(err, null, 2));
        }
      }
    );
}

const onReceiveContact = (data, user, db, socket) => {
  if(!authModule.assureSignedIn(user, socket)) return;
  console.log('Got a contact!')

  const contact = {
    userId: user.userId,
    lookupId: data.lookup,
    // clientId: parseInt(data.contact_id),
    clientId: parseInt(data._id),
    name: data.display_name,
    pinned: !!parseInt(data.pinned),
    starred: !!parseInt(data.starred),
    lastUpdated: data.contact_last_updated_timestamp,
    visible: !!parseInt(data.in_visible_group),
    phones: [],
    other: data
  }

  if(!!data.photo) {
    let fileName = uuidv4();;
    let uri = './images/' + fileName + '.png';
    fs.writeFile(uri, data.image, { encoding: 'base64', flag: 'w+' }, function(err) {
      if(!err) {
        console.log('Wrote contact photo successfully')
      }
      else {
        console.log('Error while writing contact photo');
        console.log(err);
      }
    });

    contact.photo = fileName;
  }

  db.collection('contacts')
    .findOne(
      { userId: user.userId, clientId: contact.clientId },
      (err, res) => {
        if(!err) {
          const newPhoneNumber = cleanPhoneNumber(data.phone);

          if(res == null) {
            contact.phones = [newPhoneNumber];
            db.collection('contacts')
              .insertOne(contact, (err, res) => {
                if(!err) {
                  console.log('Saved new contact successfully');
                }
                else {
                  console.log('Error while saving new contact');
                  console.log(JSON.stringify(err, null, 2));
                }
              })
          }
          else {
            if(res.phones.indexOf(newPhoneNumber) === -1) {
              console.log('Adding phone number to existing contact')
              db.collection('contacts')
                .updateOne(
                  { userId: user.userId, clientId: contact.clientId },
                  { $push: { phones: newPhoneNumber } },
                  (err, res) => {
                    if(!err) {
                      console.log('Saved updated contact successfully');
                    }
                    else {
                      console.log('Error while saving updated contact');
                      console.log(JSON.stringify(err, null, 2));
                    }
                  }
                );
            }
          }
        }
        else {
          console.log('Error while finding contact');
          console.log(JSON.stringify(err, null, 2));
        }
      }
    )
}

module.exports = {
  onReceiveConversation: onReceiveConversation,
  onReceiveContactRecipientId: onReceiveContactRecipientId,
  onReceiveSms: onReceiveSms,
  onReceiveMms: onReceiveMms,
  onReceiveContact: onReceiveContact
}
