'use strict'

var MQTT_URL = "mqtt://homectl.local/"
var MQTT_TOPIC = "/hvac/intesis"
var MQTT_STATE_TOPIC = "/stat" + MQTT_TOPIC
var MQTT_COMMAND_TOPIC = "/cmnd" + MQTT_TOPIC

var INTESIS_IP = "192.168.1.231"

var winston = require('winston')

const logger = require('winston').createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.simple()
      ),
    transports: [
      new winston.transports.Console()
    ]
  });

  Object.assign({}, {});

var mqtt = require('mqtt')
var wmp = require('./wmp');

var mqttClient = mqtt.connect(MQTT_URL)

//todo detect connection failures

var wmpclient = wmp.connect(INTESIS_IP, function(data){
    logger.info("Connected to WMP");
})

mqttClient.on('error', function(error){
    logger.error("Error from mqtt broker: %v", error)
});

mqttClient.on('connect', function(connack){
    logger.info("Connected to mqtt broker")
});

wmpclient.on('close', function() {
	logger.warn('WMP Connection closed');
});

var runWMP2Mqtt = function(mqttClient, wmpclient){
    wmpclient.on('update', function(data){
        logger.debug('Sending to MQTT: ' + JSON.stringify(data));
        mqttClient.publish(MQTT_STATE_TOPIC, JSON.stringify(data))
    });
}

var parseCommand = function(cmd) {
    var rv = {};
    var parts = cmd.split(":");

    rv['command'] = parts[0];

    if(parts.length > 1) {
        var params = parts[1].split("=");

        rv['feature'] = params[0];
        if(params.length > 1) {
            rv['value'] = params[1];
        }
    }

    return rv;
}

var runMqtt2WMP = function(mqttClient, wmpclient){
    mqttClient.subscribe(MQTT_COMMAND_TOPIC)

    // format of commands is <command>:<feature>=<value>
    mqttClient.on('message', function (topic, message) {
        var cmd = parseCommand(message.toString());
        switch(cmd.command) {
            case "ID":
                wmpclient.id(function(data){
                    logger.debug("published to mqtt: %", JSON.stringify(data))
                    mqttClient.publish(MQTT_STATE_TOPIC, JSON.stringify(data))
                });
                break;
            case "INFO":
                wmpclient.info(function(data){
                    logger.debug("published to mqtt: %", JSON.stringify(data))
                    mqttClient.publish(MQTT_STATE_TOPIC, JSON.stringify(data))
                });
            break;
            case "GET":
                wmpclient.get(cmd.feature, function(data){
                    logger.debug("published to mqtt: %", JSON.stringify(data))
                    mqttClient.publish(MQTT_STATE_TOPIC, JSON.stringify(data))
                });
        break;
        }
    })
}

runWMP2Mqtt(mqttClient, wmpclient)
runMqtt2WMP(mqttClient, wmpclient)