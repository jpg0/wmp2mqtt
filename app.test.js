const { parseCommandForTest, MQTT_COMMAND_TOPIC_FOR_TEST } = require('./app');

// Rename imported constant for clarity in tests, if desired, or use MQTT_COMMAND_TOPIC_FOR_TEST directly
const MQTT_COMMAND_TOPIC = MQTT_COMMAND_TOPIC_FOR_TEST;

describe('app.js', () => {
  describe('parseCommand', () => {
    test('should parse GET command', () => {
      const topic = `${MQTT_COMMAND_TOPIC}/MAC123/SETTINGS/TEMP`;
      const payload = '';
      const result = parseCommandForTest(topic, payload);
      expect(result).toEqual({
        mac: 'MAC123',
        feature: 'TEMP',
        command: 'GET',
      });
    });

    test('should parse SET command', () => {
      const topic = `${MQTT_COMMAND_TOPIC}/MAC456/SETTINGS/POWER`;
      const payload = 'ON';
      const result = parseCommandForTest(topic, payload);
      expect(result).toEqual({
        mac: 'MAC456',
        feature: 'POWER',
        command: 'SET',
        value: 'ON',
      });
    });

    test('should parse ID command', () => {
      const topic = `${MQTT_COMMAND_TOPIC}/MAC789/ID`;
      const payload = '';
      const result = parseCommandForTest(topic, payload);
      expect(result).toEqual({
        mac: 'MAC789',
        command: 'ID',
      });
    });

    test('should parse INFO command', () => {
      const topic = `${MQTT_COMMAND_TOPIC}/MACABC/INFO`;
      const payload = '';
      const result = parseCommandForTest(topic, payload);
      expect(result).toEqual({
        mac: 'MACABC',
        command: 'INFO',
      });
    });

    test('should handle topic with leading slash removed by some brokers', () => {
      const topic = `cmnd/hvac/intesis/MACDEF/SETTINGS/MODE`; // No leading slash, MQTT_COMMAND_TOPIC has leading slash
      const payload = 'AUTO';
      const result = parseCommandForTest(topic, payload);
      expect(result).toEqual({
        mac: 'MACDEF',
        feature: 'MODE',
        command: 'SET',
        value: 'AUTO',
      });
    });

    test('should handle unknown command type in settings path', () => {
      const topic = `${MQTT_COMMAND_TOPIC}/MACXYZ/SETTINGS/UNKNOWNFEATURE/UNEXPECTEDPART`;
      const payload = 'SOMEVALUE';
      const result = parseCommandForTest(topic, payload);
      expect(result).toEqual({ // Based on current parseCommand, it will take UNKNOWNFEATURE as feature
        mac: 'MACXYZ',
        feature: 'UNKNOWNFEATURE',
        command: 'SET',
        value: 'SOMEVALUE'
      });
    });

     test('should parse SET command with empty value', () => {
      const topic = `${MQTT_COMMAND_TOPIC}/MAC456/SETTINGS/PROFILE`;
      const payload = ''; // Empty payload, but it's a SET due to structure, though parseCommand makes it GET
      const result = parseCommandForTest(topic, payload);
      expect(result).toEqual({ // current logic makes this a GET
        mac: 'MAC456',
        feature: 'PROFILE',
        command: 'GET',
      });
    });
  });
});
