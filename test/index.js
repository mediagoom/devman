
var express  = require('express');

var app = express();

app.get('/', function (req, res) {
  
      res.send("hello");
})


app.get('/stop', (req, res) => {

    setTimeout(() => { process.exit();}, 1000);

    res.send("stopped");
    

});


var port = 4444;

app.listen(port, function () {
        console.log('app listening on port ' + port + '!');
    })