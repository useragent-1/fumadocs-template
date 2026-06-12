import fs from 'fs/promises';
import path from 'path';

export function verifyAuth(request: Request): boolean {
  const secret = request.headers.get('x-admin-secret');
  const expectedSecret = process.env.ADMIN_SECRET;
  
  if (!expectedSecret) {
    console.error('ADMIN_SECRET is not set in environment variables');
    return false;
  }
  
  return secret === expectedSecret;
}

export interface GitTreeNode {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
}

// Helper to get absolute path from repository relative path
function getAbsolutePath(relPath: string): string {
  return path.join(process.cwd(), relPath);
}

// Walk local directory recursively
async function walkDir(dir: string, fileList: string[] = []): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await walkDir(filePath, fileList);
      } else if (file.endsWith('.mdx')) {
        fileList.push(filePath);
      }
    }
  } catch (e) {
    // If directory does not exist, return empty list
  }
  return fileList;
}

/**
 * Fetches the local file tree recursively (mocking Git tree)
 */
export async function getGitTree(): Promise<GitTreeNode[]> {
  const docsDir = path.join(process.cwd(), 'content/docs');
  const absolutePaths = await walkDir(docsDir);
  
  return absolutePaths.map(absPath => {
    // Convert to relative path with forward slashes
    let relPath = path.relative(process.cwd(), absPath).replace(/\\/g, '/');
    return {
      path: relPath,
      type: 'blob',
      sha: 'local-sha',
    };
  });
}

/**
 * Fetches content of a local file
 */
export async function getFileContent(relPath: string): Promise<{ content: string; sha: string }> {
  const absPath = getAbsolutePath(relPath);
  try {
    const content = await fs.readFile(absPath, 'utf8');
    return {
      content,
      sha: 'local-sha',
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${relPath}`);
    }
    throw error;
  }
}

/**
 * Writes content to a local file
 */
export async function writeGithubFile(
  relPath: string,
  content: string,
  sha?: string,
  message?: string
): Promise<{ sha: string }> {
  const absPath = getAbsolutePath(relPath);
  // Ensure directory exists
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, 'utf8');

  // 自动为所有新创建的父级文件夹生成 meta.json，从而使它们在侧边栏显示正确的中文分级名称
  let dir = path.dirname(absPath);
  const docsDir = path.join(process.cwd(), 'content/docs');
  
  while (dir !== docsDir && dir.startsWith(docsDir)) {
    const metaPath = path.join(dir, 'meta.json');
    try {
      await fs.access(metaPath);
    } catch {
      const folderName = path.basename(dir);
      const metaContent = JSON.stringify({ title: folderName }, null, 2);
      await fs.writeFile(metaPath, metaContent, 'utf8');
    }
    dir = path.dirname(dir);
  }

  return {
    sha: 'local-sha',
  };
}

/**
 * Deletes a local file
 */
export async function deleteGithubFile(relPath: string, sha: string, message?: string): Promise<void> {
  const absPath = getAbsolutePath(relPath);
  try {
    await fs.unlink(absPath);
    
    // Clean up empty parent directories up to content/docs
    let dir = path.dirname(absPath);
    const docsDir = path.join(process.cwd(), 'content/docs');
    while (dir !== docsDir && dir.startsWith(docsDir)) {
      const files = await fs.readdir(dir);
      if (files.length === 0) {
        await fs.rmdir(dir);
        dir = path.dirname(dir);
      } else {
        break;
      }
    }

    // 自动检测：如果所有文档均被删除，重新生成默认的 index.mdx 和 meta.json 防止 404 崩溃
    const tree = await getGitTree();
    if (tree.length === 0) {
      const defaultIndexContent = `---
title: 首页
description: 欢迎来到文档中心
---

# 首页

这是一个干净的开始。您现在可以通过后台页面创建新的文档，或者直接在此修改。`;
      await fs.writeFile(path.join(docsDir, 'index.mdx'), defaultIndexContent, 'utf8');
      
      const defaultMetaContent = JSON.stringify({
        title: "文档中心",
        pages: ["index"]
      }, null, 2);
      await fs.writeFile(path.join(docsDir, 'meta.json'), defaultMetaContent, 'utf8');
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Helper to parse Frontmatter from MDX/MD files
 */
export function parseFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter: Record<string, string> = {};
  let body = content;

  if (match) {
    body = content.substring(match[0].length).trim();
    const yamlLines = match[1].split('\n');
    for (const line of yamlLines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        // Remove surrounding quotes if any
        frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }
  }

  return {
    frontmatter,
    body,
  };
}

/**
 * Helper to construct MDX/MD files with Frontmatter
 */
export function stringifyFrontmatter(frontmatter: Record<string, string>, body: string): string {
  let fmString = '---\n';
  for (const [key, value] of Object.entries(frontmatter)) {
    // 确保值被双引号包裹，防止空字符串被 YAML 解析为 null 发生编译报错，或者带有冒号等特殊字符导致 YAML 语法错误
    const escapedValue = (value || '').replace(/"/g, '\\"');
    fmString += `${key}: "${escapedValue}"\n`;
  }
  fmString += '---\n';
  return fmString + body;
}

/**
 * Helper to compute the document slug from its file path relative to content/docs/
 */
export function getSlugFromPath(path: string): string {
  const relativePath = path.replace(/^content\/docs\//, '');
  const cleanPath = relativePath.replace(/\.mdx$/, '');
  return cleanPath;
}

/**
 * Helper to compute the file path from its slug
 */
export function getPathFromSlug(slug: string): string {
  const cleanSlug = slug.replace(/^\//, '').replace(/\/$/, '');
  return `content/docs/${cleanSlug}.mdx`;
}
