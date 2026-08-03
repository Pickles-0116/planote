/**
 * 敏感数据校验测试
 *
 * 验证 validateNoSecrets 能正确识别含 token/key/secret/password/credential
 * 字段的记录并抛错，合法数据能正常通过。
 */

import { describe, it, expect } from 'vitest';
import { validateNoSecrets } from '../validate';

describe('validateNoSecrets', () => {
  it('不含敏感字段的正常数据通过校验', () => {
    const tables = {
      plans: [
        { id: 'p1', title: '普通计划', status: 'doing', updatedAt: '2026-01-01T00:00:00Z' },
      ],
      items: [
        { id: 'i1', title: '事项', checked: false },
      ],
    };

    expect(() => validateNoSecrets(tables)).not.toThrow();
  });

  it('含 token 字段时抛错', () => {
    const tables = {
      config: [
        { id: 'c1', name: '配置', token: 'ghp_abc123', url: 'https://example.com' },
      ],
    };

    expect(() => validateNoSecrets(tables)).toThrow('安全校验失败');
    expect(() => validateNoSecrets(tables)).toThrow('token');
  });

  it('含 apiKey 字段时抛错', () => {
    const tables = {
      models: [
        { id: 'm1', name: 'GPT-4', apiKey: 'sk-xxx' },
      ],
    };

    expect(() => validateNoSecrets(tables)).toThrow('安全校验失败');
    expect(() => validateNoSecrets(tables)).toThrow('apiKey');
  });

  it('含 secret 字段时抛错', () => {
    const tables = {
      credentials: [
        { id: 'c1', clientSecret: 's3cr3t!' },
      ],
    };

    expect(() => validateNoSecrets(tables)).toThrow('安全校验失败');
    expect(() => validateNoSecrets(tables)).toThrow('clientSecret');
  });

  it('含 password 字段时抛错', () => {
    const tables = {
      users: [
        { id: 'u1', username: 'admin', password: '123456' },
      ],
    };

    expect(() => validateNoSecrets(tables)).toThrow('password');
  });

  it('含 credential 字段时抛错', () => {
    const tables = {
      auth: [
        { id: 'a1', credential: 'some-cred' },
      ],
    };

    expect(() => validateNoSecrets(tables)).toThrow('credential');
  });

  it('空表通过校验', () => {
    expect(() => validateNoSecrets({})).not.toThrow();
    expect(() => validateNoSecrets({ plans: [] })).not.toThrow();
  });

  it('多条记录中仅一条含敏感字段时也抛错', () => {
    const tables = {
      plans: [
        { id: 'p1', title: '安全计划' },
        { id: 'p2', title: '另一个', token: '泄漏' },
      ],
    };

    expect(() => validateNoSecrets(tables)).toThrow('token');
  });

  it('字段名大小写不敏感', () => {
    const tables = {
      test: [
        { id: 't1', TOKEN: '大写令牌' },
      ],
    };

    expect(() => validateNoSecrets(tables)).toThrow('TOKEN');
  });

  it('错误信息包含表名和行号便于排查', () => {
    const tables = {
      aiModels: [
        { id: 'm1', name: '模型1' },
        { id: 'm2', name: '模型2', apiKey: 'sk-xxx' },
        { id: 'm3', name: '模型3' },
      ],
    };

    try {
      validateNoSecrets(tables);
      expect.fail('应抛错');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('aiModels');
      expect(msg).toContain('第 2 条');
    }
  });
});
