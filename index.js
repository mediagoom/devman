#!/usr/bin/env node

const chokidar = require('chokidar');
const cp       = require('child_process');
const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const yargs    = require('yargs');

const log = {

    info : require('debug')('devman:info')
    , watch : require('debug')('devman:watch')
    , verbose  : require('debug')('devman:verbose')
    , brief : require('debug')('devman:brief') 
    , error: console.error
};



const Reset   = '\x1b[0m';

const FgBlack   = '\x1b[30m';
const FgRed     = '\x1b[31m';
const FgGreen   = '\x1b[32m';
const FgYellow  = '\x1b[33m';
const FgBlue    = '\x1b[34m';
const FgMagenta = '\x1b[35m';
const FgCyan    = '\x1b[36m';
const FgWhite   = '\x1b[37m';

var prefixes = ['-', '+', '*', '>'];
const prefixColors = [FgGreen, FgYellow, FgBlue, FgMagenta, FgCyan];

//var action = 'run';
//var target = '.*';
var processed = false;


/*
if(process.argv.length > 2)
{
    verbose('ARGV', process.argv, process.argv.length);

    action = process.argv[2];

    if(process.argv.length > 3)
    {
        target = process.argv[3];
    }
}
*/


var app = express();
let server = undefined;

var g = []; //configurations and status
var s = []; //process running
var w = []; //watchers

app.use(express.static(__dirname));

app.get('/api', function (req, res) {
  
    res.json(g);
});

app.get('/info/:idx', (req, res) => {

    var idx = req.params.idx;
    log.verbose('info ', idx);
    var err = false;
   
    var info = s[idx].output;

    log.verbose('info result:', info);

    res.send(info);
});

app.get('/restart/:idx/:debug?', (req, res) => {

    var idx = req.params.idx;
    log.verbose('restart ', idx);
    var ret = 'restarting';
    var debug = false;

    if(req.params.debug != null && req.params.debug == 'true')
    {
        debug = true;
        ret   = 'debug';
    }

    exec(idx, debug);

    res.send(ret);
});


function exit_server()
{
    for(var i = 0; i < s.length; i++)
    {
        if(null != s[i].child)
        {
            var pid = s[i].child.pid;
            log.brief(FgYellow, 'killing: ', pid, g[i].name, Reset);
            s[i].child.stdin.pause();
            s[i].child.kill();
            //s[i].child = null;
        }
            
    }
   
    process.exitCode = 0;
    //setImmediate(()=> server.close());
    if(undefined !== server)
    {
        const timeout = setTimeout(() => {  if(undefined !== server){ server.close();}  server = undefined; }, 10);
        timeout.unref();
    }

    const timeout = setTimeout(() => { 

        log.brief('exiting from stop');
        //log.brief(FgRed, 'server exit.', Reset);
        log.brief('SEND-SIGINT');
        process.kill(process.pid, 'SIGINT');
        
    }, 100);

    timeout.unref();
   

    /*
    const timeout = setTimeout(() => { 
        log.brief('exiting from stop');
        log.brief(FgRed, 'server exit.', Reset);
        process.exit();
    }, 1000);

    timeout.unref();
    */
}

app.get('/stop', (req, res) => {

    exit_server();

    res.send('stopped');
    

});






function exitproc(k, code)
{
    g[k]['info']   = 'close ' + code;
    g[k]['status'] = 'closed';
    g[k]['lastexitcode'] = code;

    var pid = null;
    
    if(s[k].child != null)
        pid = s[k].child.pid;

    s[k].child = null;

    log.info(
        (code == 0 || null == code)?FgGreen:FgRed,
        'child end: ', pid, k, code, g[k]['status'], g[k].name
        ,Reset);
}

function stdout(data, prefix)
{
    let tokens = data.toString().split('\n');
    for(let idx = 0; idx < tokens.length; idx++)
        process.stdout.write(prefix + tokens[idx] + '\n');
}

function clear_child(child)
{
    if(child == null)
        return null;

    const events = child.eventNames();

    //for(let i = 0; i < events.length; i++)
    //child.removeAllListeners(events[i]);
}

function execnotexisting(idx, debug)
{  

    var NAME = g[idx].name;

    log.verbose(FgCyan, 'execnotexisting', NAME, idx, Reset);

    var p = g[idx];

    if(g[idx]['status'] == 'executing')
    {

        log.verbose(FgMagenta, 'Process is executing ', NAME, Reset);
        return;
    }

    g[idx]['status'] = 'executing';
   
    for(let i = 0; i < p.exec.length; i++)
    {
        let options = {};

        try{

            if(p.execOptions.length > i)
                options = p.execOptions[i];

            options.timeout = p.timeout;

            if(null != options.env)
            {
                if(null != options.env.PATH && false !== options.mergepath)
                {
                    options.env.PATH = options.env.PATH + path.delimiter + process.env.PATH;
                }
                options.env = Object.assign(process.env, options.env);
            }

            if(undefined === options.cwd)
            {
                options.cwd = p.cwd;
            }
                           
            log.info(FgGreen, NAME, ' executing: ', p.exec[i], '\noptions: ', JSON.stringify(options, null, 4), Reset);
            const b = cp.execSync(p.exec[i], options).toString();
            log.verbose(FgGreen, NAME, ' executed.');
            s[idx].output.tasks[i] = b;

            log.verbose(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>: ${NAME}`);
            log.verbose(`stdout: ${b}`);
            log.verbose(`---------------------------------------: ${NAME}`);
            log.verbose(b.toString().split('\n'));
            log.verbose(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<: ${NAME}`);

            stdout(b, p.prefix);

        }catch(err)
        {
            if(true === options.ignoreError)
            {
                log.verbose('EXEC IGNORE ERROR: ' + JSON.stringify(err, null, 4));
                log.verbose(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>: ${NAME}`);
                log.verbose(`stderr: ${err.output}`);
                log.verbose(`---------------------------------------: ${NAME}`);
                log.verbose(err.output.toString().split('\n'));
                log.verbose(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<: ${NAME}`);

                stdout(err.output, g[idx].prefix + '\tEXEC IGNORE ERROR: ');
            }
            else
            {            

                s[idx]['err'] = err;
                g[idx]['status'] = 'error';
                console.error(FgRed, p.exec[i], ' error ', err.message, Reset);
                break;
            }
        }
    }

    if(null != p.cmd && g[idx]['status'] != 'error')
    {
        //s[idx].output = { console: [], err: []};

        s[idx].output.console = [];
        s[idx].output.err = [];
           

        log.info(FgGreen, NAME, ' spawing:', p.cmd.proc, (p.cmd.args)?p.cmd.args:'--', (debug)?debug:'-x-', Reset);

        var args = [];
        if(null != p.cmd.args)
            args = p.cmd.args.slice(); //copy array

        if(debug)
        {
            for(var jj = (p.dbg_arg.length - 1); jj >= 0; jj--)
            {
                log.verbose(FgCyan, p.dbg_idx, p.dbg_arg[jj], args, Reset);
                args.splice(p.dbg_idx, 0, p.dbg_arg[jj]);
            }
                
            log.verbose(FgYellow, 
                'spawning-debug:', p.cmd.proc, args
                , Reset);
        }

        var opt = Object.assign({}, p.options);//, {shell : false});

        if(null != p.options.env
                   && null != opt.env)
        {
            if(null != opt.env.PATH && false !== opt.mergepath)
            {
                opt.env.PATH = opt.env.PATH + path.delimiter + process.env.PATH;
            }
            opt.env = Object.assign(process.env, opt.env);

            log.verbose(NAME, 'OPTIONS: ', JSON.stringify(opt, null, 4));
        }

        if(undefined === opt.cwd)
        {
            opt.cwd = p.cwd;
        }

        s[idx].child = cp.spawn(p.cmd.proc, args, opt);
        var k = idx;

        s[idx].child.on('close', (code, signal) => {
            let pid = '--';

            if(null != s[k].child)
                pid = s[k].child.pid;
            
            clear_child(s[k].child);
            s[k].child = null;

            log.brief('onclose ',  g[k].name, pid, k, code, signal);

            exitproc(k, code);
                
        });

        s[idx].child.on('exit', (code, signal) => {
            
            let pid = '--';

            if(null != s[k].child)
                pid = s[k].child.pid;

            clear_child(s[k].child);
            s[k].child = null;

            log.brief('onexit ', g[k].name, pid, k, code, g[k]['status'] == 'closing', signal);

            if(g[k]['status'] == 'closing') //close did not got called
                exitproc(k, code);
            
        });

        s[idx].child.on('error', (err) => {
            
            g[k]['info']   = 'err ' + err.message;
            s[k]['err']    = err;
            g[k]['status'] = 'error';
            s[k].child = null;

            console.log(FgRed, NAME, ' child error: ', g[k].name, k, err.message, opt);

        });

        s[idx].child.stdout.on('data', (data) => {
            //verbose(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>: ${g[k].name}`);
            //verbose(`stdout: ${data}`);
            //verbose(`---------------------------------------: ${g[k].name}`);
            //verbose(data.toString().split('\n'));
            //verbose(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<: ${g[k].name}`);
            let d = '' + data;

            s[k].output.console.push(d);
            let prefix = g[k].prefix + '\t';
            stdout(data, prefix);
           
        });

        s[idx].child.stderr.on('data', (data) => {
            //verbose(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>: ${g[k].name}`);
            //verbose(`stderr: ${data}`);
            //verbose(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<: ${g[k].name}`);
            let d = '' + data;
            s[k].output.err.push(d);
            //console.error(g[k].prefix, FgRed, data.toString(), Reset);

            stdout(data, FgRed + '!' + g[k].name + '!\t');

            if(debug)
            {
                var regexp = new RegExp(p.dbg_url, 'g');
                var m =  s[k].outerr.match(regexp);
                g[idx].debug = m;
                if(null != m)
                {
                    log.verbose('****************', m[0], '******************');
                }
            }

        });

        g[k]['status'] = 'running';
    }
    else
    {
        if(null != p.cmd)
            log.verbose(FgRed, '------>', g[idx].name, ' skip spawn on error', s[idx].output.tasks);
        else
            g[idx]['status'] = 'closed';
    }
}

function exec(idx, debug)
{
    //verbose(FgMagenta, idx, g, g[idx], Reset);

    if( g[idx]['status'] == 'closing'
    //|| g[idx]['status'] == 'closed'
    )
    {
        log.info(FgMagenta, 'Process is exiting ', idx, g[idx].status, g[idx].name, Reset);
        return;
    }

    g[idx]['status'] = 'closing';

    if(s[idx].child != null)
    {
        var pid = s[idx].child.pid;
        log.brief(FgYellow, 'killing: ', pid, g[idx].name, Reset);
        var k = idx;
        s[idx].child.on('exit', (code, signal) => {
                 
            log.brief(FgMagenta, 'kill exit', pid, g[idx].name, g[idx].status, Reset);
                 
            var j = k;
            setTimeout(() => {execnotexisting(j, debug);}, 50);
        });

        s[idx].child.kill();
        s[idx].child = null;
    }
    else
    {
        setTimeout(() => {execnotexisting(idx, debug);}, 50);
    }
}

function proc(next, idx)
{  
    var p = g[idx];
    
    var NAME = p.name;
   
    if(null != p.watch && 0 < p.watch.length)
    {
        p.watch.push('!.git/**/*');
        p.watch.push('!node_modules/**/*');

        log.watch(FgGreen, idx, NAME, p.watch, Reset);

        var kidx = idx;
        var watcher = chokidar.watch(p.watch).on('all', (event, path) => {
                   
            log.watch(FgCyan, 'watch event ' + kidx, event, path, Reset);

            if('change' == event)
            {
                if(s[idx].change)
                {
                    log.info(FgYellow, NAME, 'Discard Duplicated Change', kidx, g[kidx].name, Reset);
                    return;
                }

                log.watch(FgCyan, 'watch change event ' + kidx, event, path, Reset);
                   
                s[idx].change = true;
                exec(kidx);

                       

                setTimeout(() => {s[kidx].change = false;}, 5000);
            }
            //verbose(event, path);

        }); 

        setTimeout(() => { log.watch(FgGreen, NAME, 'Watching',  watcher.getWatched(), Reset); }, 2000);

        w[idx] = watcher;
    }

    exec(idx);
    next();
}

function http_get(url, callback)
{
    log.brief('http get', url);

    require('http').get(url, (res) => {

        const statusCode = res.statusCode;

        if (statusCode !== 200) {
            const error = new Error('Request Failed.\n' +
                                  `Status Code: ${statusCode}`);
            callback(error);
            return;
        }

        res.setEncoding('utf8');
        var rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () => {
            callback(null, rawData);
        });
    }).on('error', (e) => {
        callback(e); 
    });
}

function empty(){}

var next = empty;


function checkurl(timeout, url, count, max)
{
    setTimeout( () => {  
                
        http_get(url, function(err, body){
                
            if(err)
            {
                log.verbose('cannot call ', url, count, max, err);

                if(count < max)
                {
                    checkurl(timeout, url, count + 1, max);
                }
                else
                {
                    console.err('cannot call ', url);
                    process.exitCode = 5;
                }

            }
            else
            {
                log.info('GOT', url);//, body);
            }
                
        });
    }, timeout);
}




function info(argv)
{
    log.verbose('info', argv.target);

    http_get('http://localhost:' + argv.port + '/info/' + argv.target , function(err, body)
    {   
        if(err)
        {
            console.error('error', err);
            process.exitCode = 8;
        }
        else
        {
            var j = JSON.parse(body);
            //console.log(j);
            j.tasks.forEach((l) => process.stdout.write(l));
            //console.log(body);
            j.console.forEach((l) => process.stdout.write(l));
            j.err.forEach((l) => process.stderr.write(l));
                    
        }
                                                       
    });

    processed = true;
}

function restart(argv)
{
    log.verbose('restart', argv.target);

    http_get('http://localhost:' + argv.port + '/restart/' + argv.target , function(err, body)
    {   if(err)
    {
        console.error('error', err);
        process.exitCode = (9);
    }
    else
    {
        console.log(body);
    }
                                                       
    });

    processed = true;
}

function target_and_port_config(yargs)
{
    return yargs.positional('target', {
        describe: 'a regex for all target to be executed in devman.json'
        ,type: 'string'
        ,default: '.*'
    }).option('port', {
        alias: 'p'
        , default: '2999'
    }).option('cwd', {
        alias: 'd'
        , default: process.cwd()
    });
}

function run_and_start_config(yargs)
{
    target_and_port_config(yargs);
    return yargs.option('config', {
        alias: 'c'
        ,default: './devman.json'
    });
}

yargs.command(['run [target]', '$0'], 'run devman' 
    , (yargs) => {

        run_and_start_config(yargs);
    }
    , (argv) => {

        let target = argv.target;

        var patt = new RegExp(target);

        const config   = require(path.resolve(argv.cwd, argv.config));

        log.verbose('CONFIG PROCESSES', config.proc.length);
        log.verbose('RUN ACTION', patt, config.proc.length, prefixes, prefixes.length);

        var upl = (config.proc.length - 1);

        for(let i = upl; i >= 0; i--)
        {
        //verbose("RUN", i, prefixes[ i % prefixes.length]);

            var ff = next;
            let pp = config.proc[i];

            var d = {

                'name'  : 'none'
                , 'watch' : []
                , 'exec'  : []
                , 'execOptions' : []
                , 'cmd'   : null 
                , 'debug' : false 
                , 'break' : false
                , 'index' : i
                , 'timeout' : 35000
                , 'dbg_idx' : 0
                , 'dbg_arg' : ['--inspect', '--debug-brk']
                , 'dbg_url' : 'chrome-devtools:\/\/[^\\s\\n\\r]+'
                , 'prefix'  : prefixes[ i % prefixes.length]
                , 'color'   : prefixColors[ i % prefixes.length]
                , 'cwd'     : argv.cwd
            };

            pp = Object.assign(d, pp);
            var dorun = patt.test(pp.name);
        
            log.verbose('RUN', d.name, i, JSON.stringify(pp, null, 4), i, dorun);

            pp.prefix = pp.color + pp.prefix + pp.name + pp.prefix + Reset;
        
            g[i] = pp;
            s[i] = {
                'change' : false
                , 'output' : { 'console': [], 'err': [], 'tasks' : [] }
            };
        
            if(dorun)
            {
                log.verbose(FgGreen, '\t', '-----', pp.name, Reset);
                const mf  = (upl == i)?empty:ff;
                const idx = i;
       
                //var nn = () => {proc(mf, idx);}
                var nn = function(){proc(mf, idx);};

                next = nn;
            }

        }

        next();

        processed = true;

        let callback = null;

        callback = function() {
        
            log.brief('ON-SIGINT');

            process.removeListener('SIGINT', callback);
            
            exit_server();
        };

        process.on('SIGINT', callback);

        server = app.listen(argv.port, function () {
            log.brief('app listening on port ' + argv.port + '!');
        });


    }).command('all', 'get all'

    , (yargs) => { target_and_port_config(yargs); }
    , (args) => {
        log.verbose('all', args.target);

        http_get('http://localhost:' + args.port + '/api', function(err, body)
        {   
            if(err)
            {
                log.error('error', err);
                process.exitCode = (7);
            }
            else
            {
                var j = JSON.parse(body);
                console.log(JSON.stringify(j, null, 4));
            }
                                                                
        });

        processed = true;

    }).command('start', 'start devman in a separate process'

    , (yargs) => {
        run_and_start_config(yargs);
        
    }
    , (argv) => {
            
        log.brief('START>>', argv.target, process.argv[1], argv.config);

        //path normalize
        const config   = require(path.resolve(argv.cwd, argv.config));

        const out = fs.openSync('./out.log', 'a');
        const err = fs.openSync('./out.log', 'a');
            
        var child = cp.spawn('node', [ process.argv[1], 'run', argv.target, '--config', argv.config, '--port', argv.port]
            , {
                detached: true
                , stdio: [ 'ignore', out, err ]
                , cwd: process.cwd()
            });
        
        log.verbose('start child %O', child);
        
        //fs.writeFileSync("./pid", child.pid);
        
        //console.log('started', child.pid);    
        
        child.unref();
        
        var info = config[argv.target];
        
        if(null != info)
        {
            if(null != info.url)
            {
                var timeout = 10000;
        
                if(null != info.timeout)
                    timeout = info.timeout;
                    
                checkurl(timeout, info.url, 0, 5);
                    
            }
        
        }
        
        processed = true;
                          
    }).command('stop', 'stop a devman process'
    , (yargs) => { target_and_port_config(yargs); }
    , (argv) => {
        
        log.verbose('STOP');

        http_get('http://localhost:' + argv.port + '/stop', function(err, body)
        {   
            if(err)
            {
                log.error('error', err);
                process.exitCode = 6;
            }
            else
            {
                log.verbose('exited', body);
            }
        });
     
        processed = true;

    }).command('info', 'return server info'
    , (yargs) => { target_and_port_config(yargs); }
    , (argv) => { info(argv);
    }).command('restart', 'return server info'
    , (yargs) => { target_and_port_config(yargs); }
    , (argv) => { restart(argv);}
).help()
    .argv;




    



