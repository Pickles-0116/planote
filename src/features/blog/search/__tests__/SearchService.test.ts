/**
 * BlogSearchService 单元测试（V1.2 B4 关键路径 2）
 *
 * 测试零依赖检索引擎的：加权排序、CJK 子串命中、评分、命中片段（snippet）。
 * 运行：`pnpm test src/features/blog/search/__tests__/SearchService.test.ts`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BlogSearchService } from '../SearchService';
import type { Blog, ID } from '@/types/domain';

const BLOG_DEFAULTS = {
  title: '',
  content: { type: 'doc' as const, content: [] as never[] },
  contentText: '',
  excerpt: '',
  tagIds: [] as ID[],
  folderId: 'folder-root',
  attachmentIds: [] as ID[],
  status: 'draft' as const,
  source: 'direct' as const,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function makeBlog(over: Partial<Blog> & { id: ID }): Blog {
  return { ...BLOG_DEFAULTS, ...over } as Blog;
}

describe('BlogSearchService', () => {
  let svc: BlogSearchService;
  beforeEach(() => {
    svc = new BlogSearchService();
  });

  it('空查询返回空数组', () => {
    svc.setDocuments([makeBlog({ id: 'A', title: 'react' })]);
    expect(svc.search('')).toEqual([]);
    expect(svc.search('   ')).toEqual([]);
  });

  it('无命中返回空数组', () => {
    svc.setDocuments([
      makeBlog({ id: 'A', title: '苹果', contentText: '水果' }),
      makeBlog({ id: 'B', title: '香蕉', contentText: '水果' }),
    ]);
    expect(svc.search('汽车')).toEqual([]);
  });

  it('标题命中评分高于仅正文命中（title 加权更高）', () => {
    const titleHit = makeBlog({ id: 'A', title: 'React 实战', contentText: '无关背景内容' });
    const contentHit = makeBlog({
      id: 'B',
      title: '其他主题',
      contentText: 'React 实战 在正文里出现',
    });
    svc.setDocuments([contentHit, titleHit]);
    const res = svc.search('React');

    expect(res.length).toBe(2);
    // 标题命中应在最前
    expect(res[0]!.blog.id).toBe('A');
    expect(res[1]!.blog.id).toBe('B');
    // 且标题命中评分严格更高
    expect(res[0]!.score).toBeGreaterThan(res[1]!.score);
  });

  it('多词/子串混合时，title+content 双命中仍排在仅 title 命中之前', () => {
    const both = makeBlog({ id: 'A', title: 'alpha', contentText: 'beta gamma' });
    const titleOnly = makeBlog({ id: 'B', title: 'beta', contentText: 'alpha alpha alpha' });
    svc.setDocuments([titleOnly, both]);
    const res = svc.search('alpha');
    expect(res[0]!.blog.id).toBe('A');
    expect(res[0]!.score).toBeGreaterThan(res[1]!.score);
  });

  it('支持中文（CJK）子串匹配正文', () => {
    const b = makeBlog({ id: 'C', title: '博客标题', contentText: '今天学习了人工智能写作技巧' });
    svc.setDocuments([b]);
    const res = svc.search('写作');
    expect(res.length).toBe(1);
    expect(res[0]!.blog.id).toBe('C');
    expect(res[0]!.score).toBeGreaterThan(0);
  });

  it('返回命中片段，且片段包含查询词', () => {
    const titleDoc = makeBlog({ id: 'D', title: '如何写好React组件', contentText: '很长的前置内容……' });
    const contentDoc = makeBlog({
      id: 'E',
      title: '无关标题',
      contentText: '前缀文字 这里是关键词命中位置 后续还有不少内容用于验证片段截取逻辑是否正确',
    });
    svc.setDocuments([titleDoc, contentDoc]);

    const byTitle = svc.search('React')[0]!;
    expect(byTitle.snippet).toContain('React');
    expect(byTitle.snippet.length).toBeLessThanOrEqual(120);
    // 标题命中应围绕标题（片段源自 title，而不是大段正文）
    expect(byTitle.snippet).toContain('写好');

    const byContent = svc.search('关键词')[0]!;
    expect(byContent.snippet).toContain('关键词');
    expect(byContent.snippet.length).toBeLessThanOrEqual(130);
  });

  it('评分相同时按 updatedAt 降序', () => {
    const older = makeBlog({
      id: 'O',
      title: 'zoo',
      contentText: 'alpha',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    const newer = makeBlog({
      id: 'N',
      title: 'zoo',
      contentText: 'alpha',
      updatedAt: '2024-06-01T00:00:00Z',
    });
    svc.setDocuments([older, newer]);
    const res = svc.search('alpha');
    expect(res.length).toBe(2);
    expect(res[0]!.blog.id).toBe('N');
    expect(res[1]!.blog.id).toBe('O');
  });

  it('setDocuments 每次覆盖，不会混入旧文档', () => {
    svc.setDocuments([makeBlog({ id: 'X', title: 'react' })]);
    svc.setDocuments([makeBlog({ id: 'Y', title: 'vue' })]);
    const res = svc.search('react');
    expect(res.length).toBe(0);
  });
});
