
[![Build Status](https://travis-ci.org/mediagoom/devman.svg?branch=master)](https://travis-ci.org/mediagoom/devman)

# @mediagoom/devman
devman is nodejs development helper tool.

This tool allows to concurrently run more than one process.
Each process can be restarted based on file modification.

It aims at simplifying developing and testing multi-processes microservices applications.

To install run:
```npm i -D @mediagoom/devman```

## Usage
After installation create a devman.json file in your root folder.

Sample file:
```javascript
{
    "proc" : [
        {
              "name"  : "console1"
            , "watch" : ["test/**/*js"]
            , "cmd"   : {"proc": "node", "args": ["./test/consoleapp.js"]}
            , "debug" : false 
            , "break" : false
            , "options" : { "env":{
                                     "DEVMANID" : "PROCESS-1"
                                     , "CONSOLECHAR" : "[1]"
                                  }
                          }
                          
         }
         , 
         {
              "name"  : "console2"
            , "watch" : ["test/**/*js"]
            , "cmd"   : {"proc": "node", "args": ["./test/consoleapp.js"]}
            , "debug" : false 
            , "break" : false
            , "options" : { "env":{
                                      "DEVMANID" : "PROCESS-2"
                                    , "CONSOLECHAR" : "[2]"
                                  }
                          }
                          
         }
    ]

}
```

All ```proc``` in your array will be process lunched and managed by devman. Devman will use the ```cmd``` attribute to know how to lunch the processes.
In ```watch``` you can insert a glob for file witch will restart your process.

## Web

Open your browser to http://localhost:2999 to get an experimental UI to devman.

## Command Line

Run:
```
devman --help
```
to get a list of options



