'use strict';

const db = require('./db.js');
const users = db.get('users');
const asks = db.get('asks');

function create(ask) {
    return asks.insert(ask);
}

// No transaction - this is bad.
function propagate(askId, sourceUser) {
    return new Promise((resolve, reject) => {
        asks.findOne(askId).then(ask => {
            if (ask.owner !== sourceUser._id.toString() && sourceUser.inbox.indexOf(askId) < 0) {
                reject('illegal propagate');
            } else {
                const recipients = sourceUser.peers; // todo select recipients
                // todo filter who already has this ask
                Promise.all([
                    users.update(
                        {_id: {$in: recipients}},
                        {$push: {inbox: askId}},
                        {multi: true}),
                    asks.update(askId, {
                        $push: {transitions: new Transition(sourceUser._id.toString(), recipients)},
                        $set: {status: 'travelling'}
                    })]).then(resolve);
            }
        });
    });
}

function incomes(user) {
    return asks.find({_id: {$in: user.inbox}});
}

function mine(user) {
    return asks.find({owner: user._id.toString()});
}

// model

// Transition = Transition String [String]
function Transition(emitter, recipients) {
    this.emitter = emitter;
    this.recipients = recipients;
}

module.exports = {
    create: create,
    propagate: propagate,
    incomes: incomes,
    mine: mine
};
