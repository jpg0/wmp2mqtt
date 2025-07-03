'use strict'

const MQTT_TOPIC = "/hvac/intesis"
const MQTT_STATE_TOPIC = "/stat" + MQTT_TOPIC
const MQTT_COMMAND_TOPIC = "/cmnd" + MQTT_TOPIC

// Yargs and related variables will be defined inside the main block
let argv;
let supplied_intesis_ips = [];
let retain_flag = false; // Default value
let options = {}; // Default value

const mqtt = require('mqtt'); // Moved to top
const wmp = require('./wmp'); // Moved to top
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

// options is declared globally, this section was for initializing it
// based on argv which is now handled inside the main block.
// if (argv.mqttuser && argv.mqttpass) {
//     options.username = argv.mqttuser
//     options.password = argv.mqttpass
// }

// console.log('options', { options }) // This was using options potentially before it's properly set by argv

//todo detect connection failures
// let mqttClient = mqtt.connect(mqtt_url, options) // Defined in main block now
// mqttClient.on('error', function (error) {
//     logger.error("Error from mqtt broker: %v", error)
// });
// mqttClient.on('connect', function (connack) {
//     logger.info("Connected to mqtt broker")
// });

let runWMP2Mqtt = function (mqttClient, wmpclient) {
    wmpclient.on('update', function (data) {
        logger.debug('Sending to MQTT: ' + JSON.stringify(data));
        mqttClient.publish(MQTT_STATE_TOPIC + "/" + wmpclient.mac + "/settings/" + data.feature.toLowerCase(), data.value.toString().toLowerCase(), {retain:retain_flag})
    });
}

let parseCommand = function (topic, payload) {
    // format of commands is /<topic>/<mac>/<area>/<feature> payload (for set only is value
    let rv = {};
    // Ensure topic processing is consistent whether MQTT_COMMAND_TOPIC has a leading slash or not,
    // and whether the incoming topic has one or not.
    let normalizedTopic = topic.startsWith('/') ? topic : '/' + topic;
    let normalizedCommandTopic = MQTT_COMMAND_TOPIC.startsWith('/') ? MQTT_COMMAND_TOPIC : '/' + MQTT_COMMAND_TOPIC;

    // Strip prefix and split
    // Ensure we correctly find the start of the actual command part of the topic
    let commandPart = normalizedTopic;
    if (normalizedTopic.startsWith(normalizedCommandTopic)) {
        commandPart = normalizedTopic.substring(normalizedCommandTopic.length);
    }

    let parts = commandPart.replace(/^\/+/g, '').split("/");

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
				mqttClient.publish(MQTT_STATE_TOPIC, JSON.stringify(data), {retain:retain_flag})
                });
                break;
            case "INFO":
                wmpclient.info().then(function (data) {
                    logger.debug("published to mqtt: %", JSON.stringify(data))
                    mqttClient.publish(MQTT_STATE_TOPIC, JSON.stringify(data), {retain:retain_flag})
                });
                break;
            case "GET":
                wmpclient.get(cmd.feature);
                break;
            case "SET":
                wmpclient.set(cmd.feature, cmd.value);
                break;
        }
    })

    let keepalive = setInterval(function() {
        try {
            let wmpclients = Object.keys(wmpclientMap)
            wmpclients.forEach(function(mac) {
                logger.info("keepalive: keeping alive MAC " + mac)
                let wmpclient = wmpclientMap[mac];
                wmpclient.id().then(function (data) {
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

let wmpConnect = function (ip, mqttClient) { // Added mqttClient parameter
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

// const DISCOVER_WAIT = 10; //seconds // Moved into main block as it's related to execution flow

// let doDiscover = function(mqttClient) { ... }; // Definition is fine here, but invocation must be in main block

// Only run the app if executed directly
if (require.main === module) {
    const DISCOVER_WAIT = 10; //seconds

    // Moved doDiscover definition inside main block as it's part of the execution logic dependent on mqttClient
    let doDiscover = function(mqttClientArg) {
        wmp.discover(1000, function (data) {
            logger.info("Discovered")
            wmpConnect(data.ip, mqttClientArg);
        }, function(){
            if(Object.keys(macToClient).length === 0) {
                logger.info("Nothing connected, retrying discovery in " + DISCOVER_WAIT + " seconds..");
                setTimeout(() => doDiscover(mqttClientArg), DISCOVER_WAIT * 1000);
            }
        });
    }

    argv = require('yargs')
        .usage('Usage: $0 [--discover] --mqtt [mqtt url] [--mqttuser user --mqttpass pass] [--wmp ip address(,ip address,...)] [--retain [true/false]]')
        .demandOption(['mqtt'])
        .argv;

    if (argv.wmp) {
        supplied_intesis_ips = argv.wmp.split(',');
    }

    retain_flag = (argv.retain === "true") ? true : false;

    // options is already declared in the outer scope with 'let'
    if (argv.mqttuser && argv.mqttpass) {
        options.username = argv.mqttuser;
        options.password = argv.mqttpass;
    }

    const mqtt_url = argv.mqtt;
    let mqttClient = mqtt.connect(mqtt_url, options);
    mqttClient.on('error', function (error) {
        logger.error("Error from mqtt broker: %v", error);
    });
    mqttClient.on('connect', function (connack) {
        logger.info("Connected to mqtt broker")
    });

    // Execute these only when running the app directly
    supplied_intesis_ips.map(function (ip) {
        wmpConnect(ip, mqttClient);
    });

    if (argv.discover) {
        doDiscover(mqttClient);
    }

    runMqtt2WMP(mqttClient, macToClient);
}

// Module exports for testing
// These lines that were at global scope are removed from here as they are now inside the main check
// supplied_intesis_ips.map(function (ip) {
// wmpConnect(ip); // This was problematic
// });
// if (argv.discover) { // This was problematic
// doDiscover(); // This was problematic
// };

module.exports = {
    parseCommandForTest: parseCommand,
    MQTT_COMMAND_TOPIC_FOR_TEST: MQTT_COMMAND_TOPIC,
    // Export other functions or variables if needed for more tests
};