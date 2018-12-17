var net = require('net');

function parseResponse(wmpString) {
    var lines = wmpString.split('\r\n');

    while(lines[lines.length-1].length == 0) {
        lines.pop();
    }

    var segments = lines[0].split(":");
    var type = segments[0].split(",")[0];

    var rv = {
        type: type
    };

    switch(type) {
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
        case "INFO":
            //for some reason this response spans lines
            Object.assign(rv, {
                "runversion": lines[0].split(",")[1],
                "cfgversion": lines[1].split(",")[1],
                "deviceinfo": lines[2].split(",")[1],
                "hash": lines[3].split(",")[1]
            });
            break;
        case "CHN":
            var parts = segments[1].split(",");
            Object.assign(rv, {
                "feature": parts[0],
                "value": parts[1]
            })
    }

    if (type != "INFO" && lines.length > 1) {
        console.warn("Extraneous lines detected and ignored! " + wmpString)
    }

    return rv;
}

module.exports = {
    connect: function(ip) /* Promise(mac) */ {
        
        var nextCallback = null;
        var client = new net.Socket();
        var mac;
        
        client.on('data', function(data){
            var wmpdata = parseResponse(data.toString())

            if (wmpdata.type != "CHN") {
                if (nextCallback === null) {
                    console.error("Received message without callback: " + wmpdata)
                } else {
                    nextCallback(wmpdata);
                    nextCallback = null;
                }
            }
        })
        
        var on = function(event, callback) {
            if (event == "update") {
                client.on('data', function(data){
                    var wmpdata = parseResponse(data.toString())
                    if (wmpdata.type == "CHN") {
                        callback(wmpdata);
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