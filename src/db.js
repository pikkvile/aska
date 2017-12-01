'use strict';

const config = require('./config.js');

module.exports = require('monk')(config.db);
console.log('db connection to ' + config.db + ' opened');