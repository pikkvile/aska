'use strict';

const db = require('monk')('localhost/aska-dev');
const users = db.get('users');

const authorized = (req, res, next) => {
    const token = req.cookies.ASKA_TOKEN;
    if (!token) {
        res.redirect("/login");
    } else {
        users.findOne(token).then(user => {
            req.user = user;
            next();
        });
    }
};

// authenticate fake user by _id
const loginFake = (req, res) => users.findOne(req.query.uid).then(responseWithTokenCookie(res));

// creates and logs in new fake user
const createFake = (req, res) => {
    const user = {
        name: "Test user " + new Date().getTime(),
        type: 'fake',
        inbox: [],
        peers: []
    };
    users.insert(user).then(responseWithTokenCookie(res));
};

const logout = (req, res) => {
    res.clearCookie('ASKA_TOKEN');
    res.redirect('/');
};

function responseWithTokenCookie(response) {
    return (user) => {
        response.cookie('ASKA_TOKEN', user._id.toString());
        response.redirect('/');
    };
}

module.exports = {
    authorized: authorized,
    createFake: createFake,
    loginFake: loginFake,
    logout: logout
};