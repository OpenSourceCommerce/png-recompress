'use strict';
const log = require('logalot');
const {pngquant, dssim} = require('.');

pngquant.run(['--version']).then(() => {
    log.success('Pngquant Installed');
}).catch(async error => {
    log.warn(error.message);
    log.success('Pngquant Could Not Be Installed');
});

dssim.run(['-h']).then(() => {
    log.success('Dssim Installed');
}).catch(async error => {
    log.warn(error.message);
    log.success('Dssim Could Not Be Installed');
});
