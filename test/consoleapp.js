
const dt = Date.now();

const Reset   = "\x1b[0m"

const FgBlack   = "\x1b[30m"
const FgRed     = "\x1b[31m"
const FgGreen   = "\x1b[32m"
const FgYellow  = "\x1b[33m"
const FgBlue    = "\x1b[34m"
const FgMagenta = "\x1b[35m"
const FgCyan    = "\x1b[36m"
const FgWhite   = "\x1b[37m"

const id   = process.env.DEVMANID || 'IDNOPE';
const cout = process.env.CONSOLECHAR || 'xx';

let time = 1000;
let count = 1;

const cmd1 = {

    command: 'once',
    desc: 'only run once',
    builder: (yargs) => yargs
      .option('message', {
        alias: 'm',
        desc: 'message',
        type: 'string',
      }),
    handler: (argv) => {
      if (!argv._handled) 
      {
          console.log(argv.message);

          argv._handled = true
      }
    }
}



function delayed(func, time)
{
    return new Promise( (resolve, reject) => {
        setTimeout( () => {func(), resolve()}, time);        
    });
}

async function mainAsync()
{
    /*
    setTimeout(function(){
        
        const diff = Date.now() - dt;
    
        console.log(cout, FgMagenta, "DEVMAN TESTING CONSOLE", count, Reset, id, diff / 1000);
   
        main();

    }, (time = time * (count++)) );
    */

    while(true)
    {
        await delayed(()=>{

            const diff = Date.now() - dt;
    
            console.log(cout, FgMagenta, "DEVMAN TESTING CONSOLE", (count -1), Reset, id, diff / 1000);

        }, (time = time * (count++)) );
    }
    
}

function main(){mainAsync().then(()=> console.log("Done")).catch((e)=> {dbg("ERROR"); console.error(e); process.exitCode = 1;})}

const argv = require('yargs')
  .command(cmd1)
  .help()
  .wrap(null)
  .argv

if (!argv._handled)
    main();