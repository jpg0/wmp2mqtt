const wmp = require('./wmp');

describe('wmp.js', () => {
  describe('parseResponseLine', () => {
    test('should parse ACK response', () => {
      const line = 'ACK';
      // Manually extract parseResponseLine for testing since it's not directly exported
      const result = wmp.parseResponseLineForTest(line);
      expect(result).toEqual({ type: 'ACK' });
    });

    test('should parse ERR response', () => {
      const line = 'ERR';
      const result = wmp.parseResponseLineForTest(line);
      expect(result).toEqual({ type: 'ERR' });
    });

    test('should parse ID response', () => {
      const line = 'ID:MODEL,MAC,IP,PROTOCOL,VERSION,RSSI';
      const result = wmp.parseResponseLineForTest(line);
      expect(result).toEqual({
        type: 'ID',
        model: 'MODEL',
        mac: 'MAC',
        ip: 'IP',
        protocol: 'PROTOCOL',
        version: 'VERSION',
        rssi: 'RSSI',
      });
    });

    test('should parse CHN response for AMBTEMP', () => {
      const line = 'CHN:AMBTEMP,250';
      const result = wmp.parseResponseLineForTest(line);
      expect(result).toEqual({
        type: 'CHN',
        feature: 'AMBTEMP',
        value: 25.0,
      });
    });

    test('should parse CHN response for SETPTEMP', () => {
      const line = 'CHN:SETPTEMP,220';
      const result = wmp.parseResponseLineForTest(line);
      expect(result).toEqual({
        type: 'CHN',
        feature: 'SETPTEMP',
        value: 22.0,
      });
    });

    test('should parse other CHN response', () => {
      const line = 'CHN:FANSP,AUTO';
      const result = wmp.parseResponseLineForTest(line);
      expect(result).toEqual({
        type: 'CHN',
        feature: 'FANSP',
        value: 'AUTO',
      });
    });

    test('should parse default response type', () => {
      const line = 'OTHER:FEATURE,VALUE';
      const result = wmp.parseResponseLineForTest(line);
      expect(result).toEqual({
        type: 'OTHER',
        feature: 'FEATURE',
        value: 'VALUE',
      });
    });
  });

  describe('parseResponseLines', () => {
    test('should parse multiple lines', () => {
      const multiLineResponse = 'ACK\r\nID:MODEL,MAC,IP,PROTOCOL,VERSION,RSSI\r\nCHN:AMBTEMP,230\r\n';
      // Manually extract parseResponseLines for testing
      const result = wmp.parseResponseLinesForTest(multiLineResponse);
      expect(result).toEqual([
        { type: 'ACK' },
        { type: 'ID', model: 'MODEL', mac: 'MAC', ip: 'IP', protocol: 'PROTOCOL', version: 'VERSION', rssi: 'RSSI' },
        { type: 'CHN', feature: 'AMBTEMP', value: 23.0 },
      ]);
    });

    test('should handle trailing empty lines', () => {
      const responseWithEmptyLines = 'ACK\r\nCHN:FANSP,HIGH\r\n\r\n';
      const result = wmp.parseResponseLinesForTest(responseWithEmptyLines);
      expect(result).toEqual([
        { type: 'ACK' },
        { type: 'CHN', feature: 'FANSP', value: 'HIGH' },
      ]);
    });
  });
});
