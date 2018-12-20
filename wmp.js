
let net = require('net');
var debug = require('debug')('wmp')

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

const DISCOVER_PREFIX = "DISCOVER:"

module.exports = {
    discover: function(timeout, callback) {
        var dgram = require('dgram');

        var message = Buffer.from("DISCOVER\r\n");
        var client = dgram.createSocket("udp4");
        client.bind(3310);
        client.on("message", function (msg, rinfo) {
            debug("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
            if (msg.indexOf(DISCOVER_PREFIX) === 0) {
                let parts = msg.toString().substr(DISCOVER_PREFIX.length).split(",");
                callback({
                    model: parts[0],
                    mac: parts[1],
                    ip: parts[2],
                    protocol: parts[3],
                    version: parts[4],
                    rssi: parts[5]
                });
            }
        });
         
        client.on("listening", function () {
            var address = client.address();
            debug("server listening " + address.address + ":" + address.port);
            client.setBroadcast(true);
            client.send(message, 0, message.length, 3310, "255.255.255.255");
        });

        setTimeout(function(){
            client.close();
        }, timeout);
    },
    connect: function(ip) /* Promise(mac) */ {
        
        var nextCallback = null;
        var client = new net.Socket();
        var mac;
        
        client.on('data', function(data){

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
