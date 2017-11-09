'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const db = require('monk')('localhost/aska-dev');
const users = db.get('users');
const asks = db.get('asks');

const app = express();

app.set('view engine', 'pug');

const secured = (req, res, next) => {
    const token = req.cookies.ASKA_TOKEN;
    if (!token) {
        res.redirect("/login");
    } else {
        req.userId = parseInt(token);
        next();
    }
};

app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/', secured, (req, res) =>  {
    users.findOne({id: req.userId}).then(user =>
        res.render('index', {user: user}));
});

app.get('/login', (req, res) =>  {
    res.render('login');
});

app.get('/vk-auth', (req, res) =>  {
    let vkId = new Date().getTime();
    users.findOne({vkId: vkId}).then(user => {
        if (!user) {
            user = {
                vkId: vkId,
                id: vkId,
                name: "Test user " + vkId
            };
            users.insert(user);
        }
        res.cookie("ASKA_TOKEN", user.id);
        res.redirect('/');
    });
});

app.post('/ask', secured, (req, res) => {
    asks.insert({
        id: new Date().getTime(),
        owner: req.userId,
        body: req.body.ask,
        bid: req.body.bid
    }).then(() => res.redirect('/'));
});

app.listen(3000);

