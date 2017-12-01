const env = process.env.ASKA_ENV || 'dev';

const environments = {
    'dev': {
        db: 'localhost/aska-dev',
        port: 3000
    },
    'test': {
        db: 'localhost/aska-test',
        port: 3001
    }
};

module.exports = environments[env];