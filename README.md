# wmp2mqtt
Bridge from Intesis WMP protocol to MQTT

This project allows bridging from Intesis WMP protocol to MQTT. WMP is used to control HVAC systems via Intesis control boxes: https://www.intesisbox.com/en/wifi/gateways/ (note that these are 'IntesisBox' models, NOT 'IntesisHome').

# Installation

```
git clone git@github.com:/jpg0/wmp2mqtt
cd wmp2mqtt
npm install
```

# Usage
`node app.js [--discover] --mqtt [mqtt url] [--wmp ip address(,ip address,...)] [--retain [true/false]]`

Discovery will use IPv4 broadcast to try to detect and connect to all WMP devices on the subnet.

Updates will be provided in the MQTT topic: `/stat/hvac/intesis/[Intesis MAC Address]/settings/[feature]` with the payload as the value.
For example: `/stat/hvac/intesis/00000000/settings/ONOFF` with payload as `OFF`

Commands can be sent via the topic: `/cmnd/hvac/intesis/[Intesis MAC Address]/settings/[feature]` with the payload as the value to set to.
For example: `/cmnd/hvac/intesis/00000000/settings/MODE` with payload as `HEAT`

Note that sending a command with no payload will request the current state is sent as au update.

####### Retain Flag
1. `false` default value. 
1. `true` When a client subscribes to that topic, if there is a retained message in the buffer, then it is immediately sent to the subscribing client, with its RETAIN flag set, so the client knows it is not a “live” value (i.e. just published), but that it is potentially “stale” or out of date. Nonetheless, it is the last-published value, and thus represents the most up-to-date value of the data on that topic.

# Notes

- Does NOT support authenticated access to either MQTT or WMP. These would be pretty simple to add though.
- Does NOT support auto-discovery of WMP systems.
