const assert = require('chai').assert;
const r = require('request');

const config = require('../src/config.js');
const db = require('../src/db.js');
const server = require('../src/index.js');
const users = db.get('users');
const asks = db.get('asks');

function User(name) {
    this.name = name;
    this.type = 'fake';
    this.inbox = [];
    this.peers = [];
}

const testUsers = [
    new User("Test user 1"),
    new User("Test user 2"),
    new User("Test user 3"),
    new User("Test user 4"),
    new User("Test user 5")
];

const makeUsersPeers = (userName, peerNames) => users.findOne({name: userName})
        .then(user => users.find({name: {$in: peerNames}})
            .then(peers => Promise.all(peers.map(peer => makeTwoUsersPeers(user, peer)))));

const makeTwoUsersPeers = (u1, u2) => users.update(u1._id, {$push: {peers: u2._id.toString()}})
                          .then(() => users.update(u2._id, {$push: {peers: u1._id.toString()}}));

const setup = () => users.remove().then(() => asks.remove())
    .then(() => users.insert(testUsers))
    .then(() => makeUsersPeers("Test user 1", ["Test user 2", "Test user 3"]))
    .then(() => makeUsersPeers("Test user 2", ["Test user 4"]))
    .then(() => makeUsersPeers("Test user 3", ["Test user 5"]));

const postAs = (user, url, form, cb) =>
    r({
        method: 'POST',
        url: url,
        headers: {'Cookie': 'ASKA_TOKEN=' + user._id.toString()},
        form: form
    }, cb);

const getAs = (user, url, cb) =>
    r({
        method: 'GET',
        url: url,
        headers: {'Cookie': 'ASKA_TOKEN=' + user._id.toString()}
    }, cb);

const postAsk = (ask, initiator) => new Promise((resolve, reject) =>
    postAs(initiator, 'http://localhost:' + config.port + "/ask", ask, function(err, resp) {
        if (!err) {
            resolve(resp);
        } else {
            reject(err);
        }
    }));

const propagateAsk = (ask, propagator) => new Promise((resolve, reject) =>
    getAs(propagator, 'http://localhost:' + config.port + "/ask/" + ask._id.toString() + '/propagate', function(err, resp) {
        if (!err) {
            resolve(resp);
        } else {
            reject(err);
        }
    }));

function testAsk() {
    return {
        ask: 'Test ask from Test user 1',
        bid: '1000'
    };
}

after(done => server.close(() => {
    console.log("server closed");
    db.close().then(() => {
        console.log("db closed");
        done();
        process.exit();
    })
}));

describe("Asks features", function() {

    beforeEach(setup);

    it("verify beforeEach setup", done => {
        users.find()
            .then(usrs => {
                assert(usrs.filter(u => u.peers.length).length === 5);
                assert(usrs.find(u => u.name === 'Test user 2').peers.indexOf(usrs.find(u => u.name === 'Test user 1')._id.toString()) !== -1);
                assert(usrs.find(u => u.name === 'Test user 1').peers.indexOf(usrs.find(u => u.name === 'Test user 2')._id.toString()) !== -1);
            })
            .then(() => done())
            .catch(done);
    });

    it("create", done => {
        let ask = testAsk();
        users.findOne({name: 'Test user 1'}).then(initiator => {
            postAsk(ask, initiator).then(resp => {
                console.log(JSON.stringify(resp));
                assert(resp.statusCode === 302);
                assert(resp.headers['location'] === '/asks/mine');
                asks.find({}).then(asksCreated => {
                    assert(asksCreated.length === 1);
                    let askCreated = asksCreated[0];
                    assert(askCreated.body === ask.ask);
                    assert(askCreated.bid === parseInt(ask.bid));
                    let transitions = askCreated.transitions;
                    assert(transitions.length === 0);
                    assert('created' === askCreated.status);
                    let owner = askCreated.owner;
                    assert(owner === initiator._id.toString());
                    done();
                }).catch(done);
            });
        });
    });

    it("propagate", done => {
        let ask = testAsk();
        users.find({name: {$in: ['Test user 1', 'Test user 2']}}).then(us => {
            let initiator = us[0],
                propagator = us[1];
            postAsk(ask, initiator).then(() => {
                asks.findOne({owner: initiator._id.toString()}).then(ask => {
                    propagateAsk(ask, initiator).then(resp => {
                        console.log(JSON.stringify(resp));
                        assert(resp.statusCode === 200);
                    }).then(() => propagateAsk(ask, propagator)).then(() => {
                        asks.findOne(ask._id).then(askPropagatedTwice => {
                            assert('travelling' === askPropagatedTwice.status);
                            let transitions = askPropagatedTwice.transitions;
                            assert(2 === transitions.length);
                            assert(2 === transitions[0].recipients.length);
                            assert(1 === transitions[1].recipients.length);
                            done();
                        }).catch(done);
                    });
                });
            }).catch(done);
        });
    });
});


