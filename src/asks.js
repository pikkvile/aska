'use strict';

const moment = require('moment');

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
            if (hasNoAskInboxedOrOwned(ask)(sourceUser)) {
                reject('illegal propagate');
            } else {
                return Promise.all(sourceUser.peers.map(pid => users.findOne(pid))).then(recipients => {
                    let actualRecipients = recipients.filter(hasNoAskInboxedOrOwned(ask)).map(r => r._id.toString());
                    if (actualRecipients.length) {
                        return Promise.all([
                            users.update(
                                {_id: {$in: actualRecipients}},
                                {$push: {inbox: askId}},
                                {multi: true}),
                            asks.update(askId, {
                                $push: {transitions: new Transition(sourceUser._id.toString(), actualRecipients)},
                                $set: {status: 'travelling'}
                            })]).then(resolve);
                    } else {
                        resolve();
                    }
                });
            }
        });
    });
}

function isOwner(ask, user) {
    return user._id.toString() === ask.owner;
}

function hasNoAskInboxedOrOwned(ask) {
    return user => user.inbox.indexOf(ask._id.toString()) === -1 && !isOwner(ask, user);
}

function incomes(user) {
    return asks.find({_id: {$in: user.inbox}}).then(asks => {
        return asks.map(ask => {
            ask.hasBeenPropagatedByMe = ask.transitions.some(tr => tr.emitter === user._id.toString());
            ask.myCompletion = ask.completions.find(cmp => cmp.completer === user._id.toString());
            return ask;
        });
    });
}

function mine(user) {
    return asks.find({owner: user._id.toString()});
}

function complete(askId, completor) {
    return asks.update(askId, {$push: {completions: new Completion(completor)}});
}

function cancel(askId, canceller) {
    return new Promise((resolve, reject) => {
        asks.findOne(askId).then(ask => {
            if (!isOwner(ask, canceller)) {
                reject('illegal cancel');
            } else {
                asks.update(askId, {$set: {status: 'cancelled'}}).then(resolve);
            }
        });
    });
}

// model

// Transition = Transition String [String]
function Transition(emitter, recipients) {
    this.emitter = emitter;
    this.recipients = recipients;
}

function Completion(completer) {
    this.proposedAt = new Date();
    this.status = 'pending'; // pending / accepted / rejected
    this.completer = completer._id.toString(); // completor user id
}

module.exports = {
    create: create,
    propagate: propagate,
    incomes: incomes,
    mine: mine,
    complete: complete,
    cancel: cancel
};
