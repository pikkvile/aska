'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const sec = require('./security.js');

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
        res.render('index', {
            user: req.user,
            asks: asks
        })
    });
});
app.get('/ask', sec.authorized, (req, res) => res.render('ask', {user: req.user}));
app.post('/ask', sec.authorized, (req, res) => {

    const user = req.user;

    // insert new ask into asks collection
    asks.insert({
        createdAt: new Date().getTime(),
        owner: req.user._id,
        body: req.body.ask,
        bid: req.body.bid

    }).then(ask => {
        const recipients = user.peers; // collection of ids
        users.update(
            {_id: {$in: recipients}},
            {$push: {inbox: ask._id}},
            {multi: true})
            .then(() => res.redirect('/'));
    });
});

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

// ask is: id: Long, ownerId: Long, body: Text, header: Optional<String>, bid: Double, tags: List<String>
// ----------------------------------------------------------------------------
// | header.orElse(body.take(100))|                                   | 1000 P|
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