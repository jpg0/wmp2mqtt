'use strict'

const MQTT_TOPIC = "/hvac/intesis"
const MQTT_STATE_TOPIC = "/stat" + MQTT_TOPIC
const MQTT_COMMAND_TOPIC = "/cmnd" + MQTT_TOPIC

const argv = require('yargs')
    .usage('Usage: $0 [--discover] --mqtt [mqtt url] [--mqttuser user --mqttpass pass] [--wmp ip address(,ip address,...)] [--retain [true/false]]')
    .demandOption(['mqtt'])
    .argv;

let supplied_intesis_ips = [];

if (argv.wmp) {
    supplied_intesis_ips = argv.wmp.split(',');
}

const state = {}


let retain_flag = argv.retain ?? false
console.log('RETAIN?', retain_flag)

const mqtt_url = argv.mqtt;

var winston = require('winston');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.simple()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

const options = {}
if (argv.mqttuser && argv.mqttpass) {
    options.username = argv.mqttuser
    options.password = argv.mqttpass
}

console.log('options', { options })

const mqtt = require('mqtt')
const wmp = require('./wmp');

//todo detect connection failures
let mqttClient = mqtt.connect(mqtt_url, options)
mqttClient.on('error', function (error) {
    logger.error("Error from mqtt broker: %v", error)
});
mqttClient.on('connect', function (connack) {
    logger.info("Connected to mqtt broker")
});

let runWMP2Mqtt = function (mqttClient, wmpclient) {
    wmpclient.on('update', function (data) {
        logger.debug('Update', data);

        state[data.feature.toLowerCase()] = data.value.toString().toLowerCase()

        if (data.feature.toLowerCase() === 'onoff') {
            if (data.value.toLowerCase() === 'off') {
                mqttClient.publish(MQTT_STATE_TOPIC + "/" + wmpclient.mac + "/settings/mode", "off", { retain: retain_flag })
                logger.debug('Publish', { topic: MQTT_STATE_TOPIC + "/" + wmpclient.mac + "/settings/mode", payload: "off" })

                return
            }
        } 

        // Dont publish any mode values if the ONOFF is off
        if(data.feature.toLowerCase() === 'mode') {
            if(state.onoff === 'off') {
                logger.debug('Publish - Ignored')
                return
            }
        }

        mqttClient.publish(MQTT_STATE_TOPIC + "/" + wmpclient.mac + "/settings/" + data.feature.toLowerCase(), data.value.toString().toLowerCase(), { retain: retain_flag })
        logger.debug('Publish', { topic: MQTT_STATE_TOPIC + "/" + wmpclient.mac + "/settings/" + data.feature.toLowerCase(), payload: data.value.toString().toLowerCase() })

    });
}

let parseCommand = function (topic, payload) {
    // format of commands is /<topic>/<mac>/<area>/<feature> payload (for set only is value
    let rv = {};
    //strip prefix and split
    let parts = topic.substr(MQTT_COMMAND_TOPIC.length).replace(/^\/+/g, '').split("/");

    payload = payload.toString('utf-8')


    rv['mac'] = parts[0];

    switch (parts[1].toUpperCase()) {
        case "SETTINGS":
            rv['feature'] = parts[2]
            if (payload && payload.length > 0) {
                rv['command'] = "SET";
                rv['value'] = payload;
            } else {
                rv['command'] = "GET";
            }
            break;
        default:
            rv['command'] = parts[1];
    }

    console.log('parseCommand', { topic, payload: JSON.stringify(payload), parts, rv })
    return rv;
}

var runMqtt2WMP = function (mqttClient, wmpclientMap) {
    mqttClient.subscribe(MQTT_COMMAND_TOPIC + "/#")

    mqttClient.on('message', function (topic, message) {
        let cmd = parseCommand(topic, message);
        let wmpclient = wmpclientMap[cmd.mac];

        if (!wmpclient) {
            logger.warn("Cannot find WMP server with MAC " + cmd.mac + "! Ignoring...")
            return;
        }

        switch (cmd.command) {
            case "ID":
                wmpclient.id().then(function (data) {
                    logger.debug("published to mqtt: %", JSON.stringify(data))
                    mqttClient.publish(MQTT_STATE_TOPIC, JSON.stringify(data), { retain: retain_flag })
                });
                break;
            case "INFO":
                wmpclient.info().then(function (data) {
                    logger.debug("published to mqtt: %", JSON.stringify(data))
                    mqttClient.publish(MQTT_STATE_TOPIC, JSON.stringify(data), { retain: retain_flag })
                });
                break;
            case "GET":
                wmpclient.get(cmd.feature);
                break;
            case "SET":
                // Override SET MODE off to SET ONOFF OFF
                if (cmd.feature.toLowerCase() === 'mode') {
                    if(cmd.value.toLowerCase() === 'off') {
                      wmpclient.set('ONOFF', 'OFF');
                    } else {
                        wmpclient.set('ONOFF', 'ON');
                        wmpclient.set('MODE', cmd.value);
                    }
                } else {
                    wmpclient.set(cmd.feature, cmd.value);
                }

                break;
        }
    })

    let keepalive = setInterval(function () {
        try {
            let wmpclients = Object.keys(wmpclientMap)
            wmpclients.forEach(function (mac) {
                logger.info("keepalive: keeping alive MAC " + mac)
                let wmpclient = wmpclientMap[mac];
                wmpclient.get('*').then(function (data) {
                    //todo: something useful with keepalive?
                });

            });
        } catch (err) {
            logger.warn(err);
            logger.warn("Failure in keepalive (connection dead?)");
        }
    }, 30000);
}

var macToClient = {};

let wmpConnect = function (ip) {
    //todo: prevent duplicate registrations
    wmp.connect(ip).then(function (wmpclient) {
        logger.info("Connected to WMP at IP " + ip + " with MAC " + wmpclient.mac);

        wmpclient.on('close', function () {
            logger.warn('WMP Connection closed! Closing MQTT connection and exiting...');
            mqttClient.end(false, {}, () => process.exit(-1));
        });

        macToClient[wmpclient.mac] = wmpclient

        runWMP2Mqtt(mqttClient, wmpclient)
    })
};

supplied_intesis_ips.map(function (ip) {
    wmpConnect(ip);
});

const DISCOVER_WAIT = 10; //seconds

let doDiscover = function () {
    wmp.discover(1000, function (data) {
        logger.info("Discovered")
        wmpConnect(data.ip);
    }, function () {
        if (Object.keys(macToClient).length === 0) {
            logger.info("Nothing connected, retrying discovery in " + DISCOVER_WAIT + " seconds..");
            setTimeout(doDiscover, DISCOVER_WAIT * 1000)
        }
    });
}

if (argv.discover) {
    doDiscover();
};


runMqtt2WMP(mqttClient, macToClient);