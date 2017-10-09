const authModule = require('./authModule.js');

const getListing = (data, user, db, socket) => {
  if(!authModule.assureSignedIn(user, socket)) return;
  console.log('Getting listing!');

  db.collection('conversations')
    .aggregate([
        { $match: { userId: user.userId } },
        {
            $lookup: {
                from: 'texts',
                localField: 'threadId',
                foreignField: 'threadId',
                as: 'messages'
            }
        },
        {
            $project: {
                _id:  1,
                threadId: 1,
                userId: 1,
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
        {
            $sort: {
                'messages.date': -1
            }
        },
        {
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
        {
            $sort: {
                'message.date': -1
            }
        },
        {
            $limit: 20
        },
        {
            $lookup: {
                from: 'contacts',
                localField: 'userId',
                foreignField: 'userId',
                as: 'contacts'
            }
        },
        {
            $project: {
                _id:  1,
                threadId: 1,
                userId: 1,
                message: 1,
                contacts: {
                    $filter: {
                        input: '$contacts',
                        as: 'contact',
                        cond: {
                            $in: ['$$ROOT.message.phone', '$$contact.phones']
                        }
                    }
                }
            }
        },
        {
            $addFields: {
                contact: {
                    $arrayElemAt: ['$contacts', 0]
                }
            }
        },
        {
            $project: {
                contacts: 0
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
