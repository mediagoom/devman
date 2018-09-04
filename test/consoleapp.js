

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

function main()
{
    setTimeout(function(){
        
        const diff = Date.now() - dt;
    
        console.log(cout, FgMagenta, "DEVMAN TESTING CONSOLE", count, Reset, id, diff / 1000);
   
        main();

    }, (time = time * (count++)) );
}


main();