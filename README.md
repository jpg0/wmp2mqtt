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
`node app.js \<mqtt ip> <intesis ip(s)>`

# Notes

- Does NOT support authenticated access to either MQTT or WMP. These would be pretty simple to add though.
- Does NOT support auto-discovery of WMP systems.
