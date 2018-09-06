#!/usr/bin/env node

var chokidar = require('chokidar');
var cp       = require('child_process');
var express  = require('express');
var fs       = require('fs');
var path     = require('path')
var info     = require('debug')('devman:info');
var watchinfo= require('debug')('devman:watch');
var verbose  = require('debug')('devman:verbose');

var prefixes = ['--', '++', '**', '>>'];

var config   = require(path.resolve(process.cwd(), './devman.json'));

const Reset   = "\x1b[0m"

const FgBlack   = "\x1b[30m"
const FgRed     = "\x1b[31m"
const FgGreen   = "\x1b[32m"
const FgYellow  = "\x1b[33m"
const FgBlue    = "\x1b[34m"
const FgMagenta = "\x1b[35m"
const FgCyan    = "\x1b[36m"
const FgWhite   = "\x1b[37m"

var action = "run";
var target = ".*";
var processed = false;


if(process.argv.length > 2)
{
    verbose("ARGV", process.argv, process.argv.length);

    action = process.argv[2];

    if(process.argv.length > 3)
    {
        target = process.argv[3];
    }
}


var app = express();

var port = 2999;

app.use(express.static(__dirname));

app.get('/api', function (req, res) {
  
      res.json(g);
})

app.get('/info/:idx', (req, res) => {

    var idx = req.params.idx;
    verbose('info ', idx);
    var err = false;
   
    var info = s[idx].output;

    verbose('info result:', info);

    res.send(info);
});

app.get('/restart/:idx/:debug?', (req, res) => {

        var idx = req.params.idx;
        verbose('restart ', idx);
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

app.get('/stop', (req, res) => {

    for(var i = 0; i < s.length; i++)
    {
        if(null != s[i].child)
            s[i].child.kill();
    }

    setTimeout(() => { process.exit();}, 1000);

    res.send("stopped");
    

});

var g = []; //configurations and status
var s = []; //process running
var w = []; //watchers



verbose("CONFIG PROCESESS", config.proc.length);

function clear_child(child)
{
        if(child == null)
                return null;

        child
}

function execnotexisting(idx, debug)
{  

   var NAME = g[idx].name;

   verbose(FgCyan, 'execnotexisting', NAME, idx, Reset);

   var p = g[idx];

    if(g[idx]['status'] == 'executing')
    {

         verbose(FgMagenta, 'Process is executing ', NAME, Reset);
         return;
    }

   g[idx]['status'] = 'executing';
   
   for(i = 0; i < p.exec.length; i++)
   {
        try{
           
                info(FgGreen, NAME, " executing: ", p.exec[i], Reset);
                var b = cp.execSync(p.exec[i], {timeout : p.timeout}).toString();
                    
                s[idx].output.tasks[i] = b;

                //verbose(b);
                process.stdout.write(g[idx].prefix + '\t' + b);

        }catch(err)
        {
            s[idx]['err'] = err;
            g[idx]['status'] = 'error';
            verbose(p.exec[i], ' error ', err.message);
            break;
        }
   }

   if(null != p.cmd && g[idx]['status'] != 'error')
   {
           //s[idx].output = { console: [], err: []};

           s[idx].output.console = [];
           s[idx].output.err = [];
           

           info(FgGreen, NAME, ' spawing:', p.cmd.proc, (p.cmd.args)?p.cmd.args:'--', (debug)?debug:'-x-', Reset);

           var args = p.cmd.args.slice();

           if(debug)
           {
                  for(var jj = (p.dbg_arg.length - 1); jj >= 0; jj--)
                  {
                          verbose(FgCyan, p.dbg_idx, p.dbg_arg[jj], args, Reset);
                          args.splice(p.dbg_idx, 0, p.dbg_arg[jj]);
                  }
                
               verbose(FgYellow, 
                               'spawing-debug:', p.cmd.proc, args
                               , Reset);
           }

           var opt = Object.assign({}, p.options, {shell : true});

           if(null != p.options.env
                   && null != opt.env)
           {
               opt.env = Object.assign(process.env, opt.env);

               //verbose(NAME, " env: ", JSON.stringify(opt, null, 4));
           }

           s[idx].child = cp.spawn(p.cmd.proc, args, opt);
           var k = idx;

           s[idx].child.on('close', (code, signal) => {
                g[k]['info']   = "close " + code;
                g[k]['status'] = "closed";
                g[k]['lastexitcode'] = code;

                var pid = null;
                
                if(s[k].child != null)
                   pid = s[k].child.pid;

                s[k].child = null;

                info(
                        (code == 0 || null == code)?FgGreen:FgRed,
                        'child end: ', pid, k, code, g[k]['status'], g[k].name
                        ,Reset);
           });

           s[idx].child.on('error', (err) => {
                g[k]['info']   = "err " + err.message;
                s[k]['err']    = err;
                g[k]['status'] = "error";
                s[k].child = null;

                info(FgRed, NAME, ' child error: ', g[k].name, k, err.message, opt);

           });

         s[idx].child.stdout.on('data', (data) => {
          //verbose(`stdout: ${data}`);
            let d = '' + data;
            s[k].output.console.push(d);
            
            process.stdout.write(g[k].prefix + '\t' + data.toString());

            
        });

         s[idx].child.stderr.on('data', (data) => {
          //verbose(`stderr: ${data}`);
            let d = '' + data;
            s[k].output.err.push(d);
            console.error(g[k].prefix, FgRed, data.toString(), Reset);

            if(debug)
            {
                      var regexp = new RegExp(p.dbg_url, 'g');
                      var m =  s[k].outerr.match(regexp);
                      g[idx].debug = m;
                      if(null != m)
                      {
                        verbose('****************', m[0], '******************');
                      }
            }

        });

        g[k]['status'] = "running";
   }
   else
   {
        if(null != p.cmd)
           verbose(FgRed, '------>', g[idx].name, ' skip spawn on error', s[idx].output.tasks);
        else
           g[idx]['status'] = "closed";
   }
}

function exec(idx, debug)
{
   //verbose(FgMagenta, idx, g, g[idx], Reset);

   if( g[idx]['status'] == 'closing'
     //|| g[idx]['status'] == 'closed'
     )
   {
         info(FgMagenta, 'Process is exiting ', idx, g[idx].status, g[idx].name, Reset);
         return;
   }

   g[idx]['status'] = 'closing';

   if(s[idx].child != null)
   {
        var pid = s[idx].child.pid;
        verbose(FgYellow, 'killing: ', pid, g[idx].name, Reset);
         var k = idx;
         s[idx].child.on('close', (code, signal) => {
                 
                 verbose(FgMagenta, 'kill close', pid, g[idx].name, g[idx].status, Reset);
                 
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
       p.watch.push("!.git/**/*");
       p.watch.push("!node_modules/**/*");

       watchinfo(FgGreen, idx, NAME, p.watch, Reset);

           var kidx = idx;
           var watcher = chokidar.watch(p.watch).on('all', (event, path) => {
                   
            watchinfo(FgCyan, 'watch ' + kidx, event, path, Reset);

                   if('change' == event)
                   {
                       if(s[idx].change)
                       {
                               info(FgYellow, NAME, "Discard Duplicated Change", kidx, g[kidx].name, Reset);
                               return;
                       }
                   
                        s[idx].change = true;
                            exec(kidx);

                       

                        setTimeout(() => {s[kidx].change = false}, 5000);
                   }
                   //verbose(event, path);

                }); 

             setTimeout(() => { watchinfo(FgGreen, NAME, "Watching",  watcher.getWatched(), Reset); }, 2000);

             w[idx] = watcher;
   }

  exec(idx);
  next();
}

function http_get(url, callback)
{
    
    require('http').get(url, (res) => {

        const statusCode = res.statusCode;

        if (statusCode !== 200) {
                error = new Error(`Request Failed.\n` +
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

var next = empty

var patt = new RegExp(target);

if("run" === action)
{
    verbose("RUN ACTION", patt, config.proc.length, prefixes, prefixes.length);

    var upl = (config.proc.length - 1);

    for(i = upl; i >= 0; i--)
    {
        //verbose("RUN", i, prefixes[ i % prefixes.length]);

        var ff = next;
        var pp = config.proc[i];

         var d = {
              "name"  : "none"
            , "watch" : []
            , "exec"  : []
            , "cmd"   : null 
            , "debug" : false 
            , "break" : false
            , "index" : i
            , "timeout" : 35000
            , "dbg_idx" : 0
            , "dbg_arg" : ['--inspect', '--debug-brk']
            , "dbg_url" : 'chrome-devtools:\/\/[^\\s\\n\\r]+'
            , "prefix"  : prefixes[ i % prefixes.length]
         };

   var pp = Object.assign(d, pp);
   var dorun = patt.test(pp.name);
  
   verbose("RUN", d.name, i, JSON.stringify(pp, null, 4), i, dorun);
   
   g[i] = pp;
   s[i] = {
             "change" : false
            , "output" : { "console": [], "err": [], "tasks" : [] }
        };
        
        if(dorun)
        {
            verbose(FgGreen, "\t", "-----", pp.name, Reset);
            const mf  = (upl == i)?empty:ff;
            const idx = i;
       
            //var nn = () => {proc(mf, idx);}
            var nn = function(){proc(mf, idx);}

            next = nn;
        }

    }

    next();

    processed = true;

    app.listen(port, function () {
        verbose('app listening on port ' + port + '!');
    })


}

function checkurl(timeout, url, count, max)
{
    setTimeout( () => {  
                
                http_get(url, function(err, body){
                
                    if(err)
                    {
                        verbose("cannot call ", url, count, max, err);

                        if(count < max)
                        {
                            checkurl(timeout, url, count + 1, max);
                        }

                    }
                    else
                    {
                        verbose("GOT", url);//, body);
                    }
                
                });
            }, timeout);
}

if("start" === action)
{
    verbose("START", target);

    const out = fs.openSync('./out.log', 'a');
    const err = fs.openSync('./out.log', 'a');
    
    var child = cp.spawn("node", [ process.argv[1], "run", target]
                , {
                    detached: true
                  , stdio: [ 'ignore', out, err ]
                  , cwd: process.cwd()
                });

    child.unref();

    var info = config[target];

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
                  
}

if("stop" === action)
{
    verbose("STOP", target);

   http_get('http://localhost:' + port + '/stop', function(err, body)
           {   if(err)
               {
                   verbose("error", err);
               }
               else
               {
                  verbose("exited", body);
               }
                                                       
           });

   processed = true;
}

if("all" === action)
{
    verbose("all", target);

   http_get('http://localhost:' + port + '/api', function(err, body)
           {   if(err)
               {
                   console.error("error", err);
               }
               else
               {
                   var j = JSON.parse(body);
                  console.log(JSON.stringify(j, null, 4));
               }
                                                       
           });

   processed = true;
}

if("info" === action)
{
    verbose("info", target);

   http_get('http://localhost:' + port + '/info/' + target , function(err, body)
           {   if(err)
               {
                   console.error("error", err);
               }
               else
               {
                  var j = JSON.parse(body);
                  //console.log(j);
                  j.tasks.forEach((l) => process.stdout.write(l))
                  //console.log(body);
                  j.console.forEach((l) => process.stdout.write(l))
                  j.err.forEach((l) => process.stderr.write(l))
                  
               }
                                                       
           });

   processed = true;
}

if("restart" === action)
{
    verbose("restart", target);

   http_get('http://localhost:' + port + '/restart/' + target , function(err, body)
           {   if(err)
               {
                   console.error("error", err);
               }
               else
               {
                  console.log(body);
               }
                                                       
           });

   processed = true;
}

