'use strict';

const db = require('./db.js');
const users = db.get('users');
const asks = db.get('asks');

function create(ask, user) {
    return asks.insert(ask).then(ask => propagate(ask._id, user))
}

// todo mocha test this
// No transaction - this is bad.
function propagate(askId, sourceUser) {
    return asks.findOne(askId)
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

function incomes(user) {
    return asks.find({_id: {$in: user.inbox}});
}

function mine(user) {
    return asks.find({owner: user._id.toString()});
}

module.exports = {
    create: create,
    propagate: propagate,
    incomes: incomes,
    mine: mine
};