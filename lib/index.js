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
    let lastResult;
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
        const temporaryFile = path.resolve(__dirname, getTemporaryFilePath(inputMd5, quality));

        try {
            await execa(pngquant.path(), ['--quality', `${quality}-${quality}`, '--speed', '7', input, '--output', temporaryFile, '--force']);

            if (fs.existsSync(temporaryFile)) {
                const result = await checkResult(input, temporaryFile);

                if (!result) {
                    continue;
                }

                if (!lastResult || lastResult[0] > result[0]) {
                    lastResult = result;
                } else if (lastResult[0] < result[0]) {
                    break;
                }
            }
        } catch (error) {
            await deleteTemporaryFile(inputMd5, qualities);

            if (error.exitCode !== 99) {
                throw error;
            }
        }
    }

    if (lastResult) {
        fs.copyFileSync(lastResult[1], output);
    } else {
        fs.copyFileSync(input, output);
    }

    await deleteTemporaryFile(inputMd5, qualities);
};

const checkResult = async (input, temporaryFile) => {
    const sizeResult = await compareSize(input, temporaryFile);

    if (sizeResult[temporaryFile] < sizeResult[input]) {
        return dssimCmp([input, temporaryFile]);
    }

    return null;
};

const deleteTemporaryFile = async (inputMd5, qualities) => {
    for await (const quality of qualities) {
        const temporaryFile = path.resolve(__dirname, getTemporaryFilePath(inputMd5, quality));
        if (fs.existsSync(temporaryFile)) {
            fs.unlinkSync(temporaryFile);
        }
    }
};

const getTemporaryFilePath = (inputMd5, quality) => {
    return `../tmp/test-${inputMd5}-${quality}.png`;
};

const dssimCmp = async inputs => {
    let result;
    const {stdout} = await execa(dssim.path(), inputs.slice(0, 2));
    const rs = stdout.split('\n');
    let item = rs[0];
    item = item.split('\t');

    if (item[1] === inputs[0]) {
        return null;
    }

    const sizeResult = await compareSize(inputs[0], item[1]);

    if (sizeResult[inputs[0]] > sizeResult[item[1]]) {
        result = item;
    }

    return result;
};

module.exports = {
    pngquant,
    dssim,
    pngRecompress
};
