const assert = require('chai').assert;

const db = require('monk')('localhost/aska-test');
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

after(() => db.close());

describe("Asks features", function() {

    beforeEach(setup);

    it("test beforeEach setup", (done) => {
        users.find()
            .then(usrs => {
                assert(usrs.filter(u => u.peers.length).length === 4);
                assert(usrs.find(u => u.name === 'Test user 2').peers.indexOf(usrs.find(u => u.name === 'Test user 1')._id.toString()) !== -1);
                assert(usrs.find(u => u.name === 'Test user 1').peers.indexOf(usrs.find(u => u.name === 'Test user 2')._id.toString()) !== -1);
            })
            .then(() => done())
            .catch(done);
    });
});


