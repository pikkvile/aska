'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const config = require('./config.js');

const sec = require('./security.js');
const asksrv = require('./asks.js');

const db = require('./db.js');
const users = db.get('users');
const asks = db.get('asks');

const app = express();
app.set('view engine', 'pug');

app.use(express.static('public'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: false}));

// security
app.get('/login', (req, res) => res.render('login'));
app.get('/fake-create', sec.createFake);
app.get('/fake-login', sec.loginFake);
app.get('/logout', sec.logout);

// asks
app.get(['/', '/asks'], sec.authorized, (req, res) => asksrv.incomes(req.user).then(asks => {
        res.render('income-asks', {
            user: req.user,
            asks: asks
        })
    })
);
app.get('/asks/mine', sec.authorized, (req, res) => asksrv.mine(req.user).then(asks => {
        res.render('mine-asks', {
            user: req.user,
            asks: asks
        })
    })
);
app.get('/ask', sec.authorized, (req, res) => res.render('ask', {user: req.user}));
app.post('/ask', sec.authorized, (req, res) => asksrv.create(new Ask(req)).then(() => res.redirect('/asks/mine')));
app.get('/ask/:id/propagate', sec.authorized, (req, res) =>
    asksrv.propagate(req.params.id, req.user).then(
        () => res.redirect('/asks'),
        () => res.sendStatus(403)));
app.get('/ask/:id/cancel', sec.authorized, (req, res) =>
    asksrv.cancel(req.params.id, req.user).then(
        () => res.redirect('/asks/mine'),
        () => res.sendStatus(403)));

// todo
// 1. Add Completion in pending state (asksrv.complete) --DONE--
// 2. initiator sees completors contacts when select one
// 3. If/when request is fulfilled, initiator closes request (this triggers payments and stop all work on request)
app.get('/ask/:id/complete', sec.authorized, (req, res) =>
    asksrv.complete(req.params.id, req.user)
    .then(() => res.redirect('/asks')));

// contacts
app.get('/contacts', sec.authorized, (req, res) =>  {
    users.find({_id: {$in: req.user.peers}}).then(contacts => {
        res.render('contacts', {
            user: req.user,
            contacts: contacts.map(c => {return {name: c.name}})
        })
    });
});

const server = app.listen(config.port, function() {
    console.log('server is up, port ' + config.port);
});

// model
function Ask(req) {
    this.createdAt = new Date().getTime();
    this.owner = req.user._id.toString();
    this.body = req.body.ask;
    this.bid = parseFloat(req.body.bid);
    this.tags = [];
    this.transitions = []; // see Transition in asks.js
    this.status = 'created'; // created / travelling / resolved / cancelled
    this.completions = []; // [Completion]
}

// for tests
module.exports = server;

// ask is: id: Long, ownerId: Long, body: Text, header: Optional<String>, bid: Double, tags: List<String>
// ----------------------------------------------------------------------------
// | created at | received_from |                                     | 1000 P|
// |--------------------------------------------------------------------------|
// | body                                                                     |
// |--------------------------------------------------------------------------|
// | <tag> <tag> <tag>                                                Owner?  |
// ----------------------------------------------------------------------------

// 1. user can create an ASK
//    - Q: who will see it? A: there're options: all peers, selected peers (by groups or individually), peers mathed
//                             by tags or relevancy. First option is the easiest.

// 2. user can have peers
//    - Q: how two users can become peers?

// 3. user once received an ask can propagate it (same as create, no routing yet implemented)

// 4. asks can be satisfied (completed, fulfilled)

// User only knows his own peer who sent as ask to him... he does not see all chain.