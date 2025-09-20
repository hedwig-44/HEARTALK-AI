import { ProviderFactory, defaultProviderFactory, createByteplusProvider } from '../src/services/ProviderFactory.js';
import ByteplusProvider from '../src/services/ByteplusProvider.js';
import { AIProvider } from '../src/models/AIProvider.js';

describe('ProviderFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new ProviderFactory();
  });

  afterEach(() => {
    factory.clearAllProviders();
  });

  describe('registerProvider', () => {
    it('should register a new provider type', () => {
      class TestProvider extends AIProvider {
        async generateResponse() { return {}; }
        async generateStreamResponse() { return; }
        async translateText() { return {}; }
        async healthCheck() { return true; }
      }

      factory.registerProvider('test', TestProvider);
      expect(factory.isTypeSupported('test')).toBe(true);
      expect(factory.getAvailableTypes()).toContain('test');
    });

    it('should throw error for invalid provider type', () => {
      expect(() => {
        factory.registerProvider('', ByteplusProvider);
      }).toThrow('Provider type must be a non-empty string');

      expect(() => {
        factory.registerProvider(null, ByteplusProvider);
      }).toThrow('Provider type must be a non-empty string');
    });

    it('should throw error for invalid provider class', () => {
      expect(() => {
        factory.registerProvider('test', null);
      }).toThrow('ProviderClass must be a constructor function');

      expect(() => {
        factory.registerProvider('test', 'not-a-class');
      }).toThrow('ProviderClass must be a constructor function');
    });
  });

  describe('createProvider', () => {
    it('should create Byteplus provider with valid config', () => {
      const config = {
        apiKey: 'test-api-key',
        chatEndpoint: 'ep-chat-test-endpoint',
        workAssistantEndpoint: 'ep-work-test-endpoint'
      };

      const provider = factory.createProvider('byteplus', config);
      
      expect(provider).toBeInstanceOf(ByteplusProvider);
      expect(provider.getName()).toBe('byteplus');
    });

    it('should throw error for unsupported provider type', () => {
      expect(() => {
        factory.createProvider('unsupported', {});
      }).toThrow('Unsupported provider type: unsupported');
    });

    it('should throw error for invalid config', () => {
      expect(() => {
        factory.createProvider('byteplus', {});
      }).toThrow('Failed to create byteplus provider');
    });
  });

  describe('getProvider', () => {
    it('should return same instance for same config (singleton)', () => {
      const config = {
        apiKey: 'test-api-key',
        chatEndpoint: 'ep-chat-test-endpoint',
        workAssistantEndpoint: 'ep-work-test-endpoint'
      };

      const provider1 = factory.getProvider('byteplus', config);
      const provider2 = factory.getProvider('byteplus', config);

      expect(provider1).toBe(provider2);
      expect(factory.getStatus().active_instances).toBe(1);
    });

    it('should return different instances for different configs', () => {
      const config1 = {
        apiKey: 'api-key-1-abcd',
        chatEndpoint: 'ep-chat-test-endpoint-1',
        workAssistantEndpoint: 'ep-work-test-endpoint-1'
      };

      const config2 = {
        apiKey: 'different-key-2', 
        chatEndpoint: 'ep-chat-test-endpoint-2',
        workAssistantEndpoint: 'ep-work-test-endpoint-2'
      };

      const provider1 = factory.getProvider('byteplus', config1);
      const provider2 = factory.getProvider('byteplus', config2);

      expect(provider1).not.toBe(provider2);
      expect(factory.getStatus().active_instances).toBe(2);
    });
  });

  describe('removeProvider', () => {
    it('should remove specific provider instance', () => {
      const config = {
        apiKey: 'test-api-key',
        chatEndpoint: 'ep-chat-test-endpoint',
        workAssistantEndpoint: 'ep-work-test-endpoint'
      };

      factory.getProvider('byteplus', config);
      expect(factory.getStatus().active_instances).toBe(1);

      factory.removeProvider('byteplus', config);
      expect(factory.getStatus().active_instances).toBe(0);
    });

    it('should remove all providers of a type', () => {
      const config1 = {
        apiKey: 'api-key-1-abcd',
        chatEndpoint: 'ep-chat-test-endpoint-1',
        workAssistantEndpoint: 'ep-work-test-endpoint-1'
      };

      const config2 = {
        apiKey: 'different-key-2',
        chatEndpoint: 'ep-chat-test-endpoint-2', 
        workAssistantEndpoint: 'ep-work-test-endpoint-2'
      };

      factory.getProvider('byteplus', config1);
      factory.getProvider('byteplus', config2);
      expect(factory.getStatus().active_instances).toBe(2);

      factory.removeProvider('byteplus');
      expect(factory.getStatus().active_instances).toBe(0);
    });
  });

  describe('healthCheckAll', () => {
    it('should perform health check on all providers', async () => {
      const config = {
        apiKey: 'test-api-key',
        chatEndpoint: 'ep-chat-test-endpoint',
        workAssistantEndpoint: 'ep-work-test-endpoint'
      };

      // 创建provider但不进行真实的健康检查
      const provider = factory.getProvider('byteplus', config);
      
      // Mock health check to avoid real API calls
      const mockHealthCheck = async () => true;
      mockHealthCheck.calls = [];
      const originalHealthCheck = provider.healthCheck;
      provider.healthCheck = async (...args) => {
        mockHealthCheck.calls.push(args);
        return mockHealthCheck();
      };

      const results = await factory.healthCheckAll();
      
      expect(Object.keys(results)).toHaveLength(1);
      expect(Object.values(results)[0]).toEqual({
        healthy: true,
        type: 'byteplus',
        error: null
      });
      
      // 验证healthCheck被调用了
      expect(mockHealthCheck.calls).toHaveLength(1);
    });
  });

  describe('getStatus', () => {
    it('should return factory status information', () => {
      const status = factory.getStatus();

      expect(status).toHaveProperty('registered_types');
      expect(status).toHaveProperty('active_instances');
      expect(status).toHaveProperty('instance_keys');
      expect(status.registered_types).toContain('byteplus');
    });
  });
});

describe('defaultProviderFactory', () => {
  it('should be an instance of ProviderFactory', () => {
    expect(defaultProviderFactory).toBeInstanceOf(ProviderFactory);
  });

  it('should have byteplus provider registered by default', () => {
    expect(defaultProviderFactory.isTypeSupported('byteplus')).toBe(true);
  });
});

describe('convenience functions', () => {
  afterEach(() => {
    defaultProviderFactory.clearAllProviders();
  });

  describe('createByteplusProvider', () => {
    it('should create a new Byteplus provider instance', () => {
      const config = {
        apiKey: 'test-api-key',
        chatEndpoint: 'ep-chat-test-endpoint',
        workAssistantEndpoint: 'ep-work-test-endpoint'
      };

      const provider = createByteplusProvider(config);
      
      expect(provider).toBeInstanceOf(ByteplusProvider);
      expect(provider.getName()).toBe('byteplus');
    });
  });
});