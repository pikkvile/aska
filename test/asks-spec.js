const assert = require('chai').assert;
const r = require('request');

const config = require('../src/config.js');
const aska = require('../src/index.js');
const server = aska.server;
const db = aska.db;
const users = db.get('users');
const asks = db.get('asks');

const testUsers = [
    {
        name: "Test user 1",
        type: 'fake',
        inbox: [],
        peers: []
    },
    {
        name: "Test user 2",
        type: 'fake',
        inbox: [],
        peers: []
    },
    {
        name: "Test user 3",
        type: 'fake',
        inbox: [],
        peers: []
    },
    {
        name: "Test user 4",
        type: 'fake',
        inbox: [],
        peers: []
    },
];

const makeUsersPeers = (userName, peerNames) => users.findOne({name: userName})
        .then(user => users.find({name: {$in: peerNames}})
            .then(peers => Promise.all(peers.map(peer => makeTwoUsersPeers(user, peer)))));

const makeTwoUsersPeers = (u1, u2) => users.update(u1._id, {$push: {peers: u2._id.toString()}})
                          .then(() => users.update(u2._id, {$push: {peers: u1._id.toString()}}));

const setup = () => users.remove().then(() => asks.remove())
    .then(() => users.insert(testUsers))
    .then(() => makeUsersPeers("Test user 1", ["Test user 2", "Test user 3"]))
    .then(() => makeUsersPeers("Test user 2", ["Test user 4"]));

const postAs = (userName, url, form, cb) => {
    users.findOne({name: userName}).then(user =>
        r({
            method: 'POST',
            url: url,
            headers: {'Cookie': 'ASKA_TOKEN=' + user._id.toString()},
            form: form
        }, function(err, resp, body) {
            let requestInitiator = user._id.toString();
            cb(requestInitiator, err, resp, body);
        }));
};

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
                assert(usrs.filter(u => u.peers.length).length === 4);
                assert(usrs.find(u => u.name === 'Test user 2').peers.indexOf(usrs.find(u => u.name === 'Test user 1')._id.toString()) !== -1);
                assert(usrs.find(u => u.name === 'Test user 1').peers.indexOf(usrs.find(u => u.name === 'Test user 2')._id.toString()) !== -1);
            })
            .then(() => done())
            .catch(done);
    });

    it("create", done => {
        let ask = {
            ask: 'Test ask from Test user 1',
            bid: '1000'
        };
        postAs('Test user 1', 'http://localhost:' + config.port + "/ask", ask, function(requestInitiator, err, resp) {
            if (err) done(err);
            console.log(JSON.stringify(resp));
            assert(resp.statusCode === 302);
            assert(resp.headers['location'] === '/');
            asks.find({}).then(asksCreated => {
                assert(asksCreated.length === 1);
                let askCreated = asksCreated[0];
                assert(askCreated.body === ask.ask);
                assert(askCreated.bid === parseInt(ask.bid));
                let path = askCreated.path;
                assert(path.length === 1);
                let owner = path[0];
                assert(owner === requestInitiator);
                done();
            }).catch(done);
        });
    });
});


