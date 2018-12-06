'use strict';

const dbg    = require('debug')('devman:test');

var request = require('supertest')
    , express = require('express');

var app = express();

var url = 'http://localhost:2999';



const timeout = ms => new Promise(res => setTimeout(res, ms));

async function check(path)
{
    const res = await request(url).get(path);
    dbg('check', url, path, res.status);
    if(res.status != 200){throw 'INVALID STATUS RETURNED';}
    if(res.header['content-type'] != 'application/json; charset=utf-8'){throw 'INVALID CONTENT-TYPE';}

    return res.body;
}

async function getinfo(n)
{
    const body = await check('/info/' + n.toString());
    return body;
}  

async function testInfo()
{    
    let body = await getinfo('0');
    
    let idx = 0;

    dbg('BODY', body);

    while(idx < 10 && (null == body || null == body.console || 0 == body.console.length) )
    {
        await timeout(2000);
        body = await getinfo('0');
        dbg('BODY', idx, body);

        idx++;
    }

    dbg('INFO', body);
    dbg('lines', body.console.length);

    if(0 == body.console.length)
        throw 'CANNOT GET ANY OUTPUT';

}           


async function testApi()
{
    const body = await check('/api');

    dbg('API', body);
}

async function testAsync()
{
    await testApi();
    await testInfo();
}

function main()
{
    dbg('MAIN');
    testAsync().then(()=> console.log('Done')).catch((e)=> {dbg('ERROR'); console.error(e); process.exitCode = 1;});
}

dbg('RUNNING TESTS');
main();