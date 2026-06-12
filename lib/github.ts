import fs from 'fs/promises';
import path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const isGithubEnabled = !!(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);

function toBase64(str: string): string {
  try {
    return Buffer.from(str, 'utf8').toString('base64');
  } catch {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

function fromBase64(b64: string): string {
  try {
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return decodeURIComponent(escape(atob(b64)));
  }
}

function encodeGitPath(relPath: string): string {
  return relPath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

async function fetchGithub(urlPath: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `token ${GITHUB_TOKEN}`);
  headers.set('Accept', 'application/vnd.github.v3+json');
  headers.set('User-Agent', 'fumadocs-template');

  const res = await fetch(`https://api.github.com${urlPath}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${errText}`);
  }

  return res.json();
}

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
  if (!isGithubEnabled) {
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

  try {
    const data = await fetchGithub(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`
    );
    
    const tree: any[] = data.tree || [];
    return tree
      .filter(node => node.type === 'blob' && node.path.startsWith('content/docs/') && node.path.endsWith('.mdx'))
      .map(node => ({
        path: node.path,
        type: 'blob',
        sha: node.sha,
      }));
  } catch (err: any) {
    console.error('Failed to fetch Git tree from GitHub API:', err);
    throw err;
  }
}

/**
 * Fetches content of a local file
 */
export async function getFileContent(relPath: string): Promise<{ content: string; sha: string }> {
  if (!isGithubEnabled) {
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

  try {
    const encoded = encodeGitPath(relPath);
    const data = await fetchGithub(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encoded}?ref=${GITHUB_BRANCH}`
    );
    
    const content = fromBase64(data.content.replace(/\s/g, ''));
    return {
      content,
      sha: data.sha,
    };
  } catch (err: any) {
    if (err.message && err.message.includes('404')) {
      throw new Error(`File not found: ${relPath}`);
    }
    console.error(`Failed to fetch file content for ${relPath} from GitHub API:`, err);
    throw err;
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
  if (!isGithubEnabled) {
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

  try {
    const base64Content = toBase64(content);
    const encoded = encodeGitPath(relPath);
    let fileSha = sha;
    
    if (!fileSha || fileSha === 'local-sha') {
      try {
        const existingFile = await fetchGithub(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encoded}?ref=${GITHUB_BRANCH}`
        );
        fileSha = existingFile.sha;
      } catch {
        // File does not exist
      }
    }

    const body: any = {
      message: message || `Update ${relPath}`,
      content: base64Content,
      branch: GITHUB_BRANCH,
    };
    
    if (fileSha && fileSha !== 'local-sha') {
      body.sha = fileSha;
    }

    const data = await fetchGithub(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encoded}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Auto-generate meta.json for parent folders on GitHub
    const parts = relPath.split('/');
    if (parts.length > 2) {
      let parentPath = parts.slice(0, -1).join('/');
      while (parentPath !== 'content/docs' && parentPath.startsWith('content/docs')) {
        const metaPath = `${parentPath}/meta.json`;
        const encodedMeta = encodeGitPath(metaPath);
        let metaExists = false;
        try {
          await fetchGithub(
            `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedMeta}?ref=${GITHUB_BRANCH}`
          );
          metaExists = true;
        } catch {
          // meta.json does not exist
        }

        if (!metaExists) {
          const pathParts = parentPath.split('/');
          const folderName = pathParts[pathParts.length - 1];
          const metaContent = JSON.stringify({ title: folderName }, null, 2);
          const metaBase64 = toBase64(metaContent);
          
          await fetchGithub(
            `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedMeta}`,
            {
              method: 'PUT',
              body: JSON.stringify({
                message: `Create default meta.json for ${folderName}`,
                content: metaBase64,
                branch: GITHUB_BRANCH,
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            }
          ).catch(e => console.error('Failed to create meta.json:', e));
        }
        
        const parentParts = parentPath.split('/');
        parentPath = parentParts.slice(0, -1).join('/');
      }
    }

    return {
      sha: data.content.sha,
    };
  } catch (err: any) {
    console.error(`Failed to write file ${relPath} to GitHub API:`, err);
    throw err;
  }
}

/**
 * Deletes a local file
 */
export async function deleteGithubFile(relPath: string, sha: string, message?: string): Promise<void> {
  if (!isGithubEnabled) {
    const absPath = getAbsolutePath(relPath);
    try {
      await fs.unlink(absPath);
      
      // Clean up empty parent directories up to content/docs
      let dir = path.dirname(absPath);
      const docsDir = path.join(process.cwd(), 'content/docs');
      while (dir !== docsDir && dir.startsWith(docsDir)) {
        const files = await fs.readdir(dir);
        const hasOnlyMetaJson = files.length === 1 && files[0] === 'meta.json';
        const isEmpty = files.length === 0;

        if (isEmpty || hasOnlyMetaJson) {
          if (hasOnlyMetaJson) {
            await fs.unlink(path.join(dir, 'meta.json'));
          }
          await fs.rmdir(dir);
          dir = path.dirname(dir);
        } else {
          break;
        }
      }

      // 自动检测：如果所有文档均被删除，重新生成默认 of index.mdx 和 meta.json 防止 404 崩溃
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
    return;
  }

  try {
    const encoded = encodeGitPath(relPath);
    let fileSha = sha;
    if (!fileSha || fileSha === 'local-sha') {
      const existingFile = await fetchGithub(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encoded}?ref=${GITHUB_BRANCH}`
      );
      fileSha = existingFile.sha;
    }

    await fetchGithub(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encoded}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          message: message || `Delete ${relPath}`,
          sha: fileSha,
          branch: GITHUB_BRANCH,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Clean up empty parent directories on GitHub (including deleting leftover meta.json files)
    const parts = relPath.split('/');
    if (parts.length > 2) {
      let parentPath = parts.slice(0, -1).join('/');
      while (parentPath !== 'content/docs' && parentPath.startsWith('content/docs')) {
        const encodedParent = encodeGitPath(parentPath);
        let items: any[] = [];
        try {
          items = await fetchGithub(
            `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedParent}?ref=${GITHUB_BRANCH}`
          );
        } catch {
          // Folder already gone or error
          break;
        }

        // Filter out the deleted file if it's still returned in contents list
        const remainingItems = items.filter(item => item.path !== relPath);

        const hasOnlyMeta = remainingItems.length === 1 && remainingItems[0].name === 'meta.json';
        const isEmpty = remainingItems.length === 0;

        if (isEmpty || hasOnlyMeta) {
          if (hasOnlyMeta) {
            const metaPath = `${parentPath}/meta.json`;
            const encodedMeta = encodeGitPath(metaPath);
            await fetchGithub(
              `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedMeta}`,
              {
                method: 'DELETE',
                body: JSON.stringify({
                  message: `Delete empty folder meta.json for ${parentPath.split('/').pop()}`,
                  sha: remainingItems[0].sha,
                  branch: GITHUB_BRANCH,
                }),
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            ).catch(e => console.error('Failed to delete meta.json on GitHub:', e));
          }
          
          const parentParts = parentPath.split('/');
          parentPath = parentParts.slice(0, -1).join('/');
        } else {
          break;
        }
      }
    }
  } catch (err: any) {
    console.error(`Failed to delete file ${relPath} from GitHub API:`, err);
    throw err;
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
