'use strict';
const path = require('path');
const BinWrapper = require('bin-wrapper');
const fs = require('fs');
const execa = require('execa');
const compareSize = require('compare-size');
const md5 = require('md5');

const pngquant = new BinWrapper()
    .dest(path.resolve(__dirname, '../vendor'))
    .use((process.platform === 'linux') ? `${process.platform}-pngquant` : 'osx-pngquant');

const dssim = new BinWrapper()
    .dest(path.resolve(__dirname, '../vendor'))
    .use((process.platform === 'linux') ? `${process.platform}-dssim` : 'osx-dssim');

const pngRecompress = async function (min, max, input, output) {
    let temporaryFile;
    let lastResult;
    const results = [];
    const qualities = [max];
    const medium = Math.floor((min + max) / 2);
    const mediumMax = Math.round((medium + max) / 2);
    const mediumMin = Math.floor((medium + min) / 2);
    const inputMd5 = md5(input);

    if (min !== max) {
        qualities.push(min);
    }

    if (medium !== min && medium !== max) {
        qualities.push(medium);
    }

    if (mediumMax !== min && mediumMax !== max) {
        qualities.push(mediumMax);
    }

    if (mediumMin !== min && mediumMin !== max) {
        qualities.push(mediumMin);
    }

    qualities.sort().reverse();

    for await (const quality of qualities) {
        temporaryFile = path.resolve(__dirname, getTemporaryFilePath(quality));
        if (fs.existsSync(temporaryFile)) {
            fs.unlinkSync(temporaryFile);
        }

        try {
            await execa(pngquant.path(), ['--quality', `${quality}-${quality}`, '--speed', '11', input, '--output', temporaryFile]);
            results.push(temporaryFile);
        } catch (error) {
            if (error.exitCode !== 99) {
                throw error;
            }
        }
    }

    if (results.length > 0) {
        const inputs = [input].concat(results);
        for (let i = 0; i < results.length - 1; i++) {
            const end = i + 2;
            lastResult = await dssimCmp(inputs.slice(i, end <= results.length ? end : results.length));
        }
    }

    if (lastResult) {
        fs.copyFileSync(lastResult[1], output);
    } else {
        throw new Error(`Could not compress ${input} file`);
    }

    for await (const quality of qualities) {
        temporaryFile = path.resolve(__dirname, getTemporaryFilePath(quality));
        if (fs.existsSync(temporaryFile)) {
            fs.unlinkSync(temporaryFile);
        }
    }

    function getTemporaryFilePath(quality) {
        return `../tmp/test-${inputMd5}-${quality}.png`;
    }
};

const dssimCmp = async inputs => {
    let result;
    const {stdout} = await execa(dssim.path(), inputs);
    const rs = stdout.split('\n');
    let item = rs[0];
    item = item.split('\t');

    if (!result || result[0] > item[0]) {
        result = item;
    } else if (result[0] === item[0]) {
        const sizeResult = compareSize(result[1], item[1]);

        if (sizeResult[result[1]] > sizeResult[item[1]]) {
            result = item;
        }
    }

    return result;
};

module.exports = {
    pngquant,
    dssim,
    pngRecompress
};
