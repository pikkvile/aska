'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const sec = require('./security.js');
const asksrv = require('./asks.js');

const db = require('monk')('localhost/aska-dev');
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
app.get('/', sec.authorized, (req, res) =>  {
    asks.find({_id: {$in: req.user.inbox}}).then(asks => {
        res.render('asks', {
            user: req.user,
            asks: asks
        })
    });
});
app.get('/ask', sec.authorized, (req, res) => res.render('ask', {user: req.user}));
app.post('/ask', sec.authorized, (req, res) => asks.create(new Ask(req)).then(() => res.redirect('/')));
app.get('/ask/:id/propagate', sec.authorized, (req, res) => asksrv.propagate(req.params.id, req.user));

// contacts
app.get('/contacts', sec.authorized, (req, res) =>  {
    users.find({_id: {$in: req.user.peers}}).then(contacts => {
        res.render('contacts', {
            user: req.user,
            contacts: contacts.map(c => {return {name: c.name}})
        })
    });
});

app.listen(3000);

// model

function Ask(req) {
    this.createdAt = new Date().getTime();
    this.path = req.user._id.toString();
    this.body = req.body.ask;
    this.bid = parseFloat(req.body.bid);
    this.tags = [];
    this.trace = [];
}

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