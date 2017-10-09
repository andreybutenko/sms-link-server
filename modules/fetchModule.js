const authModule = require('./authModule.js');

const getListing = (data, user, db, socket) => {
  if(!authModule.assureSignedIn(user, socket)) return;
  console.log('Getting listing!');

  db.collection('conversations')
    .aggregate([
        { $match: { userId: user.userId } },
        { // find all messages for conversation
            $lookup: {
                from: 'texts',
                localField: 'threadId',
                foreignField: 'threadId',
                as: 'messages'
            }
        },
        { // limit messages to those owned by this user
            $project: {
                _id:  1,
                threadId: 1,
                userId: 1,
                recipientIds: 1,
                messages: {
                    $filter: {
                        input: '$messages',
                        as: 'message',
                        cond: {
                            $eq: ['$$message.userId', '$$ROOT.userId']
                        }
                    }
                }
            }
        },
        { // sort messages
            $sort: {
                'messages.date': -1
            }
        },
        { // get the most recent
            $addFields: {
                message: {
                    $arrayElemAt: ['$messages', 0]
                }
            }
        },
        {
            $project: {
                messages: 0
            }
        },
        { // sort then limit so next lookups aren't so heavy
            $sort: {
                'message.date': -1
            }
        },
        {
            $limit: 20
        },
        { // create new item for each receipient
            $unwind: '$recipientIds'
        },
        { // find all contacts
            $lookup: {
                from: 'contacts',
                localField: 'recipientIds',
                foreignField: 'clientId',
                as: 'contacts'
            }
        },
        {
            $project: {
                threadId: 1,
                userId: 1,
                message: 1,
                contact: { $arrayElemAt: [ '$contacts', 0 ] }
            }
        },
        { // group items with same id
            $group: {
                _id: '$_id',
                threadId: { $first: '$threadId' },
                userId: { $first: '$userId' },
                message: { $first: '$message' },
                contacts: {
                    $push: '$contact'
                }
            }
        },
        { // must resort after group
            $sort: {
                'message.date': -1
            }
        }
    ], {
      allowDiskUse: true
    })
    .toArray((err, res) => {
      console.log('wow', err, res)
      if(!err) {
        console.log('got')
        /*
        const response = res.map(conversation => {
          return {
            threadId: conversation.threadId
          }
        });*/
        const response = res;
        socket.emit('FETCH/LISTING/RESULT', response);
      }
      else {
        console.log('Error while getting listings');
        console.log(JSON.stringify(err, null, 2));
      }
    })
}

const getConversation = (data, user, db, socket) => {
  if(!authModule.assureSignedIn(user, socket)) return;
  console.log('Getting conversation!', data.threadId);

  db.collection('texts')
    .find({ userId: user.userId, threadId: data.threadId })
    .sort({ date: -1 })
    .toArray((err, res) => {
      if(!err) {
        const response = res.filter(conversation => !!conversation.phone);
        socket.emit('FETCH/CONVERSATION/RESULT', response);
      }
      else {
        console.log('Error while getting listings');
        console.log(JSON.stringify(err, null, 2));
      }
    })
}

module.exports = {
  getListing: getListing,
  getConversation: getConversation
}
