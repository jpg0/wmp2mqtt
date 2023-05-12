#!/bin/sh

echo "Using server ${MQTT_SERVER}"

ARGS=""

if ! [ "${WMP_IPS}" = "" ]
then
    ARGS="${ARGS} --wmp ${WMP_IPS}"
    echo "Got IP(s): ${WMP_IPS}"
else
    echo "No IPs specified."
fi

if [ "${DISCOVER}" = "true" ]
then
    ARGS="${ARGS} --discover"
    echo "Discovery is on."
else
    echo "Discovery is off."
fi

if [ "${RETAIN}" = "true" ]
then
    ARGS="${ARGS} --retain ${RETAIN}"
    echo "MQTT retain is on."
else
    echo "MQTT retain is off."
fi

ARGS="${ARGS} --mqtt ${MQTT_SERVER}"

if ! [ "${MQTT_USER}" = "" ]
then
    ARGS="${ARGS} --mqttuser ${MQTT_USER}"
fi
if ! [ "${MQTT_PASS}" = "" ]
then
    ARGS="${ARGS} --mqttpass ${MQTT_PASS}"
fi

while node app.js $ARGS; do
    echo "WMP2MQTT failed, restarting..."
done
