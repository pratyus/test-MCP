const logger = require('../logger');

describe('Logger Utility', () => {
  it('should be an instance of a winston logger', () => {
    // Basic check: Winston loggers typically have a 'levels' property and logging methods.
    expect(logger).toBeDefined();
    expect(logger.levels).toBeInstanceOf(Object);
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should have a stream property for morgan or similar middleware', () => {
    expect(logger.stream).toBeDefined();
    expect(typeof logger.stream.write).toBe('function');
  });

  it('should have configured transports (at least console for test env)', () => {
    // In test env (LOG_LEVEL='silent' from jest.setup.js), console might be suppressed
    // but the transport objects should still exist.
    expect(logger.transports).toBeInstanceOf(Array);
    // Depending on NODE_ENV, file transports might also be added.
    // For default 'test' NODE_ENV and LOG_LEVEL='silent', we'd expect at least console.
    // If LOG_LEVEL is silent, winston might optimize transports, so this check needs to be flexible
    // or we ensure a specific LOG_LEVEL for this test that guarantees transports.
    // For now, just checking it's an array.
    expect(logger.transports.length).toBeGreaterThanOrEqual(1); // Console + potentially file in dev
  });

  it('should respect the LOG_LEVEL from environment (or default)', () => {
    // process.env.LOG_LEVEL is set to 'silent' in jest.setup.js
    expect(logger.level).toBe('silent'); 
  });

  // Test the stream write function (used by morgan)
  describe('logger.stream.write', () => {
    it('should call logger.info with the message (stripping newline)', () => {
      const mockMessage = 'Test message from stream\n';
      // Spy on logger.info before the test and restore it after
      const infoSpy = jest.spyOn(logger, 'info');
      
      logger.stream.write(mockMessage);
      
      expect(infoSpy).toHaveBeenCalledWith('Test message from stream');
      infoSpy.mockRestore(); // Clean up the spy
    });
  });
});
