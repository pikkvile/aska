'use strict';

const db = require('monk')('localhost/aska-dev');
const users = db.get('users');
const asks = db.get('asks');

function create(ask) {
    return asks.insert(ask).then(ask => asksrv.propagate(ask._id, req.user))
}

// todo mocha test this
// No transaction - this is bad.
function propagate(askId, sourceUser) {
    return asks.find(askId)
        .then(ask => {
            const recipients = sourceUser.peers;
            return Promise.all([
                users.update(
                    {_id: {$in: recipients}},
                    {$push: {inbox: ask._id.toString()}},
                    {multi: true}),
                users.update(sourceUser._id, {$pull: {inbox: ask._id.toString()}}), /* remove from my inbox */
                asks.update(askId, {$push: {trace: sourceUser._id.toString()}}) /* update trace */
            ]);
        });
}

module.exports = {
    create: create,
    propagate: propagate
};