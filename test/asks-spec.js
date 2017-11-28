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

function insertUsers(usrs) {
    return Promise.all(usrs.map(user => users.insert(user)));
}

beforeEach(() => {
    return Promise.all([users.remove(), asks.remove()]).then(insertUsers(testUsers));
});

after(() => db.close());

describe("Asks features", function() {

    it("verify beforeEach setup", function(done) {
        users.find().then(usrs => {
            assert(testUsers.length === usrs.length);
            done();
        }).catch(done)
    });
});


