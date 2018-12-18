
let net = require('net');

function parseResponseLines(wmpString) {
    var lines = wmpString.split('\r\n');

    while(lines[lines.length-1].length == 0) {
        lines.pop();
    }

    let rv = [];

    for(let i = 0; i < lines.length; i++) {
        rv.push(parseResponseLine(lines[i]))
    }

    return rv;
}

function parseResponseLine(wmpLine) {
    var segments = wmpLine.split(":");
    var type = segments[0].split(",")[0];

    var rv = {
        type: type
    };

    switch(type) {
        case "ACK":
            break;
        case "ID":
            var parts = segments[1].split(",");
            Object.assign(rv, {
                "model": parts[0],
                "mac": parts[1],
                "ip": parts[2],
                "protocol": parts[3],
                "version": parts[4],
                "rssi": parts[5]
            });
            break;
        default:
            var parts = segments[1].split(",");
            Object.assign(rv, {
                "feature": parts[0],
                "value": parts[1]
            })
            break;
    }

    return rv;
}

module.exports = {
    connect: function(ip) /* Promise(mac) */ {
        
        var nextCallback = null;
        var client = new net.Socket();
        var mac;
        
        client.on('data', function(data){
            console.log("Received: " + data.toString())

            var wmpdata = parseResponseLines(data.toString())

            for(let i = 0; i < wmpdata.length; i++) {
                if (wmpdata[i].type != "CHN") {
                    if (nextCallback === null) {
                        console.error("Received message without callback: " + wmpdata[i])
                    } else {
                        nextCallback(wmpdata[i]);
                        nextCallback = null;
                    }
                }
            }
        });
        
        var on = function(event, callback) {
            if (event == "update") {
                client.on('data', function(data){
                    var wmpdata = parseResponseLines(data.toString())
                    for(let i = 0; i < wmpdata.length; i++) {
                        if (wmpdata[i].type == "CHN") {
                            callback(wmpdata[i]);
                        }
                    }
                });
            } else if (event == 'close') {
                client.on('close', callback);
            }
        };
        
        var id = function() {
            return sendCmd('ID')
        };
        
        var info = function() {
            return sendCmd('INFO')
        };
        
        var get = function(feature) {
            //todo: sanitise feature param
            sendCmd("GET,1:" + feature);
        };
        
        var set = function(feature, value) {
            //todo: sanitise feature & value params

            //convert decimal to 10x temp numbers
            if(feature.toUpperCase() == "SETPTEMP")
                value = value * 10;

            sendCmd("SET,1:" + feature + "," + value).then(function(data){
                if(data.type != "ACK")
                    console.error("Received non-ack message from set command: " + JSON.stringify(data))
            });
        };
        
        var sendCmd = function(cmd) {
            return new Promise(function(resolve, reject){
                nextCallback = resolve;
                client.write(cmd + '\n');
            })
        };
    
        //reconnect on close
        client.on('close', function(e) {
            client.setTimeout(5000, function() {
                client.connect(3310, ip);
            })
        });
        
        return new Promise(function(resolve, reject) {
            client.connect(3310, ip, function(){
                id().then(function(data){
                    mac = data.mac;
                    resolve({
                        on: on,
                        id: id,
                        info: info,
                        get: get,
                        set: set,
                        mac: mac
                    });
                })
            });
        });
    }
}