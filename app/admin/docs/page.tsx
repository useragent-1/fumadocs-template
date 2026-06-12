'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Save, 
  Trash2, 
  Loader2, 
  BookOpen, 
  Eye, 
  FileText,
  ChevronRight,
  LogOut,
  FolderPlus,
  Info,
  Download,
  Upload,
  Hash,
  List,
  ExternalLink,
  Copy,
  Check,
  Table,
  Minus,
  AlertTriangle,
  Lightbulb,
  type LucideIcon
} from 'lucide-react';
import JSZip from 'jszip';


interface DocItem {
  path: string;
  slug: string;
  sha: string;
  title: string;
  description: string;
  content: string;
}

export default function AdminDocsPage() {
  const [adminSecret, setAdminSecret] = useState('');
  const [isSecretSaved, setIsSecretSaved] = useState(false);
  
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form Fields
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Split Slug into Category (Folder) and Page Name (Filename)
  const [editCategory, setEditCategory] = useState('');
  const [editPageSlug, setEditPageSlug] = useState('');
  
  const [editContent, setEditContent] = useState('');
  
  const finalSlug = useMemo(() => {
    const cleanCat = editCategory.trim().replace(/^\/|\/$/g, '');
    const cleanPage = editPageSlug.trim().replace(/^\/|\/$/g, '');
    
    if (!cleanPage) return '';
    return cleanCat ? `${cleanCat}/${cleanPage}` : cleanPage;
  }, [editCategory, editPageSlug]);

  // UI State
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load secret from localStorage on mount
  useEffect(() => {
    const savedSecret = localStorage.getItem('x-admin-secret');
    if (savedSecret) {
      setAdminSecret(savedSecret);
      setIsSecretSaved(true);
    }
  }, []);

  // Fetch docs when secret is saved/configured
  useEffect(() => {
    if (isSecretSaved && adminSecret) {
      fetchDocs();
    }
  }, [isSecretSaved]);

  const saveSecret = () => {
    if (adminSecret.trim()) {
      localStorage.setItem('x-admin-secret', adminSecret);
      setIsSecretSaved(true);
      showStatus('success', '验证成功');
    } else {
      showStatus('error', '请输入有效的访问密码');
    }
  };

  const clearSecret = () => {
    localStorage.removeItem('x-admin-secret');
    setAdminSecret('');
    setIsSecretSaved(false);
    setDocs([]);
    setSelectedDoc(null);
  };

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  const fetchDocs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/docs/list', {
        headers: {
          'x-admin-secret': adminSecret,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          clearSecret();
          throw new Error('密码错误，请重新输入');
        }
        const errorData = await res.json();
        throw new Error(errorData.error || '获取文档列表失败');
      }

      const data = await res.json();
      setDocs(data);
    } catch (err: any) {
      showStatus('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to extract category and filename from a full slug
  const parseSlug = (slug: string) => {
    const parts = slug.split('/');
    if (parts.length > 1) {
      return {
        category: parts.slice(0, -1).join('/'),
        pageSlug: parts[parts.length - 1]
      };
    }
    return {
      category: '',
      pageSlug: slug
    };
  };

  const handleSelectDoc = (doc: DocItem) => {
    setIsNew(false);
    setSelectedDoc(doc);
    setEditTitle(doc.title);
    setEditDescription(doc.description);
    
    // Parse slug into category and page name inputs
    const { category, pageSlug } = parseSlug(doc.slug);
    setEditCategory(category);
    setEditPageSlug(pageSlug);
    
    setEditContent(doc.content);
    setActiveTab('edit');
  };

  const handleNewDoc = () => {
    setIsNew(true);
    setSelectedDoc(null);
    setEditTitle('');
    setEditDescription('');
    setEditCategory('');
    setEditPageSlug('');
    setEditContent('');
    setActiveTab('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalSlug) {
      showStatus('error', '页面路径不能为空');
      return;
    }

    setIsLoading(true);
    try {
      const url = isNew ? '/api/docs/create' : '/api/docs/update';
      const body = isNew 
        ? {
            slug: finalSlug,
            title: editTitle.trim(),
            description: editDescription.trim(),
            content: editContent,
          }
        : {
            path: selectedDoc?.path,
            slug: finalSlug,
            title: editTitle.trim(),
            description: editDescription.trim(),
            content: editContent,
            sha: selectedDoc?.sha,
          };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '保存失败');
      }

      const result = await res.json();
      showStatus('success', '保存成功');
      
      // Refresh list
      await fetchDocs();

      // Keep editor selected with updated info
      setIsNew(false);
      const updatedPath = result.path || `content/docs/${finalSlug}.mdx`;
      setSelectedDoc({
        path: updatedPath,
        slug: finalSlug,
        sha: result.sha,
        title: editTitle.trim(),
        description: editDescription.trim(),
        content: editContent,
      });

    } catch (err: any) {
      showStatus('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    if (!window.confirm(`确定要删除文档 "${selectedDoc.title}" 吗？`)) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/docs/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          path: selectedDoc.path,
          sha: selectedDoc.sha,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '删除失败');
      }

      showStatus('success', '文档已删除');
      setSelectedDoc(null);
      await fetchDocs();
    } catch (err: any) {
      showStatus('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique directories from existing docs list to show as autocomplete suggestions
  const existingCategories = useMemo(() => {
    const categories = docs.map(doc => {
      const { category } = parseSlug(doc.slug);
      return category;
    }).filter(cat => cat !== '');
    return Array.from(new Set(categories));
  }, [docs]);

  const stringifyFrontmatter = (title: string, description: string, content: string) => {
    let fm = '---\n';
    fm += `title: "${(title || '').replace(/"/g, '\\"')}"\n`;
    fm += `description: "${(description || '').replace(/"/g, '\\"')}"\n`;
    fm += '---\n';
    return fm + content;
  };

  const parseFrontmatterClient = (content: string, filename: string) => {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    let title = filename.replace(/\.mdx?$/, '');
    let description = '';
    let body = content;

    if (match) {
      body = content.substring(match[0].length).trim();
      const yamlLines = match[1].split('\n');
      for (const line of yamlLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          const cleanValue = value.replace(/^['"]|['"]$/g, '');
          if (key === 'title') {
            title = cleanValue;
          } else if (key === 'description') {
            description = cleanValue;
          }
        }
      }
    }

    return { title, description, body };
  };

  const handleExportZip = async () => {
    if (docs.length === 0) return;
    setIsLoading(true);
    try {
      const zip = new JSZip();
      docs.forEach(doc => {
        const fileContent = stringifyFrontmatter(doc.title, doc.description, doc.content);
        zip.file(`${doc.slug}.mdx`, fileContent);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `docs-markdown-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('success', '导出成功');
    } catch (err: any) {
      showStatus('error', `导出失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const importDocToServer = async (slug: string, title: string, description: string, content: string) => {
    const existingDoc = docs.find(d => d.slug === slug);
    const isUpdating = !!existingDoc;
    
    const url = isUpdating ? '/api/docs/update' : '/api/docs/create';
    const body = isUpdating
      ? {
          path: existingDoc.path,
          slug: slug,
          title: title,
          description: description,
          content: content,
          sha: existingDoc.sha,
        }
      : {
          slug: slug,
          title: title,
          description: description,
          content: content,
        };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || '保存失败');
    }
  };

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    let importedCount = 0;
    let errorCount = 0;
    let foundCount = 0;
    let lastErrorMessage = '';

    const cleanImportSlug = (filePath: string) => {
      let clean = filePath.replace(/\\/g, '/');
      // Remove content/docs/ or docs/ prefix if present (case-insensitive)
      clean = clean.replace(/^content\/docs\//i, '');
      clean = clean.replace(/^docs\//i, '');
      // Remove any leading slashes
      clean = clean.replace(/^\//, '');
      // Strip extension (.md or .mdx) case-insensitive
      return clean.replace(/\.mdx?$/i, '');
    };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileNameLower = file.name.toLowerCase();

        if (fileNameLower.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const zipEntries: { path: string; contentPromise: Promise<string> }[] = [];
          
          zip.forEach((relativePath, zipEntry) => {
            const entryNameLower = relativePath.toLowerCase();
            // Ignore directories, __MACOSX system files, and only include .md/.mdx
            if (!zipEntry.dir && !relativePath.startsWith('__MACOSX/') && (entryNameLower.endsWith('.md') || entryNameLower.endsWith('.mdx'))) {
              zipEntries.push({
                path: relativePath,
                contentPromise: zipEntry.async('string')
              });
            }
          });

          foundCount += zipEntries.length;

          for (const entry of zipEntries) {
            try {
              const fileContent = await entry.contentPromise;
              const { title, description, body } = parseFrontmatterClient(fileContent, entry.path);
              const slug = cleanImportSlug(entry.path);
              await importDocToServer(slug, title, description, body);
              importedCount++;
            } catch (err: any) {
              console.error(`Failed to import ${entry.path} from ZIP:`, err);
              lastErrorMessage = err.message || '网络或凭证错误';
              errorCount++;
            }
          }
        } else if (fileNameLower.endsWith('.md') || fileNameLower.endsWith('.mdx')) {
          foundCount++;
          try {
            const fileContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsText(file);
            });
            const { title, description, body } = parseFrontmatterClient(fileContent, file.name);
            const slug = cleanImportSlug(file.name);
            await importDocToServer(slug, title, description, body);
            importedCount++;
          } catch (err: any) {
            console.error(`Failed to import file ${file.name}:`, err);
            lastErrorMessage = err.message || '网络或凭证错误';
            errorCount++;
          }
        }
      }

      if (importedCount > 0) {
        showStatus('success', `成功导入 ${importedCount} 个文档${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`);
        await fetchDocs();
      } else if (foundCount > 0 && errorCount > 0) {
        showStatus('error', `导入失败：检测到 ${foundCount} 个文档，但保存全部失败。错误提示: ${lastErrorMessage}`);
      } else {
        showStatus('error', '未找到可导入的 Markdown 文档（仅支持 .zip, .md, .mdx 文件）');
      }
    } catch (err: any) {
      showStatus('error', `导入失败: ${err.message}`);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const filteredDocs = useMemo(() => {
    return docs.filter(
      (doc) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [docs, searchQuery]);

  // --- Improved Markdown Renderer ---
  const escapeHtml = useCallback((str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }, []);

  const renderInline = useCallback((text: string): string => {
    let out = text;
    // Images
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, 
      '<img src="$2" alt="$1" class="mdp-img" />');
    // Links
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="mdp-link">$1<svg class="mdp-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>');
    // Bold + Italic
    out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Strikethrough
    out = out.replace(/~~([^~]+)~~/g, '<del class="mdp-del">$1</del>');
    // Inline code
    out = out.replace(/`([^`]+)`/g, '<code class="mdp-inline-code">$1</code>');
    return out;
  }, []);

  interface TocItem {
    level: number;
    text: string;
    id: string;
  }

  const renderMarkdown = useCallback((md: string): { html: string; toc: TocItem[] } => {
    if (!md) return { html: '<p class="mdp-empty">暂无内容，请在左侧编辑器中输入 Markdown 文本</p>', toc: [] };

    const toc: TocItem[] = [];
    const lines = md.split('\n');
    const blocks: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const startI = i;

      // --- Fenced code blocks ---
      const codeMatch = line.match(/^```(\S*)/);
      if (codeMatch) {
        const lang = codeMatch[1] || '';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        const escaped = escapeHtml(codeLines.join('\n'));
        blocks.push(
          `<div class="mdp-code-block">` +
          `<div class="mdp-code-header"><span class="mdp-code-lang">${lang || 'plaintext'}</span></div>` +
          `<pre class="mdp-pre"><code>${escaped}</code></pre>` +
          `</div>`
        );
        continue;
      }

      // --- Tables ---
      const tableHeaderMatch = line.match(/^\|(.+)\|\s*$/);
      if (tableHeaderMatch && i + 1 < lines.length && lines[i + 1].match(/^\|[\s:|-]+\|\s*$/)) {
        const headers = tableHeaderMatch[1].split('|').map(h => h.trim());
        // Parse alignment row
        const alignRow = lines[i + 1].match(/^\|(.+)\|\s*$/);
        const aligns: string[] = alignRow
          ? alignRow[1].split('|').map(a => {
              const t = a.trim();
              if (t.startsWith(':') && t.endsWith(':')) return 'center';
              if (t.endsWith(':')) return 'right';
              return 'left';
            })
          : headers.map(() => 'left');
        
        let tableHtml = '<div class="mdp-table-wrap"><table class="mdp-table"><thead><tr>';
        headers.forEach((h, idx) => {
          tableHtml += `<th style="text-align:${aligns[idx] || 'left'}">${renderInline(escapeHtml(h))}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        
        i += 2; // skip header and alignment rows
        while (i < lines.length && lines[i].match(/^\|(.+)\|\s*$/)) {
          const rowMatch = lines[i].match(/^\|(.+)\|\s*$/);
          if (rowMatch) {
            const cells = rowMatch[1].split('|').map(c => c.trim());
            tableHtml += '<tr>';
            cells.forEach((c, idx) => {
              tableHtml += `<td style="text-align:${aligns[idx] || 'left'}">${renderInline(escapeHtml(c))}</td>`;
            });
            tableHtml += '</tr>';
          }
          i++;
        }
        tableHtml += '</tbody></table></div>';
        blocks.push(tableHtml);
        continue;
      }

      // --- Horizontal rule ---
      if (line.match(/^(---|\*\*\*|___)\s*$/)) {
        blocks.push('<hr class="mdp-hr" />');
        i++;
        continue;
      }

      // --- Blockquotes (multiline, with GitHub alert support) ---
      if (line.match(/^>\s?/)) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].match(/^>\s?/)) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        const quoteContent = quoteLines.join('\n');
        
        // Detect GitHub-style alerts: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
        const alertMatch = quoteContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?([\s\S]*)/);
        if (alertMatch) {
          const alertType = alertMatch[1].toLowerCase();
          const alertBody = alertMatch[2].trim();
          const alertConfig: Record<string, { cls: string; label: string }> = {
            note: { cls: 'mdp-alert-note', label: '📝 备注' },
            tip: { cls: 'mdp-alert-tip', label: '💡 提示' },
            important: { cls: 'mdp-alert-important', label: '❗ 重要' },
            warning: { cls: 'mdp-alert-warning', label: '⚠️ 警告' },
            caution: { cls: 'mdp-alert-caution', label: '🔴 注意' },
          };
          const cfg = alertConfig[alertType] || alertConfig.note;
          blocks.push(
            `<div class="mdp-alert ${cfg.cls}">` +
            `<div class="mdp-alert-title">${cfg.label}</div>` +
            `<div class="mdp-alert-body">${renderInline(escapeHtml(alertBody))}</div>` +
            `</div>`
          );
        } else {
          blocks.push(`<blockquote class="mdp-blockquote">${renderInline(escapeHtml(quoteContent))}</blockquote>`);
        }
        continue;
      }

      // --- Headers ---
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2];
        const id = text.replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
        if (level <= 3) {
          toc.push({ level, text, id });
        }
        const sizeClass = ['mdp-h1', 'mdp-h2', 'mdp-h3', 'mdp-h4', 'mdp-h5', 'mdp-h6'][level - 1];
        blocks.push(`<h${level} id="${id}" class="${sizeClass}">${renderInline(escapeHtml(text))}<a href="#${id}" class="mdp-anchor" aria-hidden="true">#</a></h${level}>`);
        i++;
        continue;
      }

      // --- Unordered list (- or *) ---
      if (line.match(/^\s*[-*]\s+/)) {
        let listHtml = '<ul class="mdp-ul">';
        while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
          const itemText = lines[i].replace(/^\s*[-*]\s+/, '');
          // Task list
          const taskMatch = itemText.match(/^\[([ xX])\]\s*(.*)/);
          if (taskMatch) {
            const checked = taskMatch[1] !== ' ';
            listHtml += `<li class="mdp-task-item"><span class="mdp-checkbox ${checked ? 'mdp-checked' : ''}">${checked ? '✓' : ''}</span>${renderInline(escapeHtml(taskMatch[2]))}</li>`;
          } else {
            listHtml += `<li>${renderInline(escapeHtml(itemText))}</li>`;
          }
          i++;
        }
        listHtml += '</ul>';
        blocks.push(listHtml);
        continue;
      }

      // --- Ordered list ---
      if (line.match(/^\s*\d+\.\s+/)) {
        let listHtml = '<ol class="mdp-ol">';
        while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
          const itemText = lines[i].replace(/^\s*\d+\.\s+/, '');
          listHtml += `<li>${renderInline(escapeHtml(itemText))}</li>`;
          i++;
        }
        listHtml += '</ol>';
        blocks.push(listHtml);
        continue;
      }

      // --- Empty line ---
      if (!line.trim()) {
        i++;
        continue;
      }

      // --- Paragraph: collect contiguous non-empty lines ---
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() && !lines[i].match(/^(#{1,6}\s|```|>\s?|\||---$|\*\*\*$|___$|\s*[-*]\s+|\s*\d+\.\s+)/)) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        blocks.push(`<p class="mdp-p">${renderInline(escapeHtml(paraLines.join('\n')))}</p>`);
      }

      // Fallback: if no block matched and i wasn't advanced, increment i to avoid infinite loop
      if (i === startI) {
        blocks.push(`<p class="mdp-p">${renderInline(escapeHtml(lines[i]))}</p>`);
        i++;
      }
    }

    return { html: blocks.join('\n'), toc };
  }, [escapeHtml, renderInline]);

  // Debounce the preview rendering to prevent typing lag
  const [debouncedContent, setDebouncedContent] = useState(editContent);

  useEffect(() => {
    // When switching documents or creating a new one, update immediately without debounce
    setDebouncedContent(editContent);
  }, [selectedDoc?.path, isNew]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedContent(editContent);
    }, 250);
    return () => clearTimeout(handler);
  }, [editContent]);

  // Memoize rendered preview
  const renderedPreview = useMemo(() => {
    return renderMarkdown(debouncedContent);
  }, [debouncedContent, renderMarkdown]);

  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);



  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Login Screen */}
      {!isSecretSaved ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
          <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4 shadow-sm border border-slate-200 dark:border-zinc-800">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold mb-4">输入密码</h2>
          <div className="w-full flex flex-col gap-2">
            <input
              type="password"
              placeholder="请输入密码..."
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSecret()}
              className="w-full px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all text-center"
            />
            <button
              onClick={saveSecret}
              className="w-full bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold py-2 rounded-lg text-sm transition-all shadow-sm"
            >
              验证并进入
            </button>
            {statusMessage && (
              <p className="text-xs text-rose-500 mt-2 font-medium">{statusMessage.text}</p>
            )}
          </div>
        </div>
      ) : (
        /* Logged In Dashboard */
        <>
          {/* Top Header */}
          <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-6 py-4.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 p-2 rounded-lg shadow-sm">
                <BookOpen className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold tracking-tight">文档管理后台</h1>
            </div>

            <div className="flex items-center gap-4">
              {statusMessage && (
                <div className={`px-3 py-1 rounded-md flex items-center gap-1.5 text-xs font-semibold animate-in fade-in duration-200 ${
                  statusMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900'
                }`}>
                  {statusMessage.text}
                </div>
              )}

              <button 
                onClick={clearSecret}
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-xs transition-all flex items-center gap-1.5 font-medium border border-transparent hover:border-slate-200 dark:hover:border-zinc-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                退出
              </button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-80 bg-white dark:bg-zinc-900 flex flex-col">
              <div className="p-4 flex flex-col gap-3">
                <button
                  onClick={handleNewDoc}
                  className="w-full bg-zinc-950 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg py-2 px-4 font-semibold text-xs flex items-center justify-center gap-2 transition-all border border-transparent active:scale-98"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新建文档
                </button>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="搜索文档..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Doc list */}
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {isLoading && docs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xxs">加载中...</span>
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-xs">
                    未找到文档
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredDocs.map((doc) => {
                      const isSelected = selectedDoc?.path === doc.path && !isNew;
                      return (
                        <button
                          key={doc.path}
                          onClick={() => handleSelectDoc(doc)}
                          className={`w-full text-left p-2.5 rounded-md flex items-start gap-2.5 transition-all text-xs border border-transparent ${
                            isSelected
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-850/50'
                          }`}
                        >
                          <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`} />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">{doc.title}</span>
                            <span className="block text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                              {doc.slug}
                            </span>
                          </div>
                          <ChevronRight className={`w-3.5 h-3.5 mt-1 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sidebar Footer for Import/Export */}
              <div className="p-4 bg-slate-50/50 dark:bg-zinc-900/30 flex flex-col gap-2 shrink-0">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  数据管理 (Markdown)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExportZip}
                    disabled={isLoading || docs.length === 0}
                    className="py-1.5 px-3 rounded-lg text-xxs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    一键导出
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById('import-file-input')?.click()}
                    disabled={isLoading}
                    className="py-1.5 px-3 rounded-lg text-xxs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    一键导入
                  </button>
                </div>
                <input
                  type="file"
                  id="import-file-input"
                  accept=".zip,.md,.mdx"
                  multiple
                  onChange={handleImportFiles}
                  className="hidden"
                />
              </div>
            </aside>

            {/* Editor Area */}
            <main className="flex-1 bg-slate-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
              {selectedDoc || isNew ? (
                <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
                  {/* Form Top Toolbar */}
                  <div className="bg-white dark:bg-zinc-900 px-6 py-3.5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isNew 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900' 
                          : 'bg-zinc-100 text-zinc-700 border-zinc-250 dark:bg-zinc-800 dark:text-zinc-350 dark:border-zinc-750'
                      }`}>
                        {isNew ? '新建' : '编辑'}
                      </span>
                      <h2 className="text-xs font-bold truncate max-w-xs md:max-w-md">
                        {isNew ? '新建文档' : editTitle}
                      </h2>
                    </div>
                  </div>

                  {/* Form fields & Editor */}
                  <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Left Column */}
                    <div className="w-full md:w-[460px] md:shrink-0 flex flex-col overflow-y-auto bg-white dark:bg-zinc-900 p-6 space-y-4">
                      
                      {/* Document Title */}
                      <div className="shrink-0">
                        <label className="block text-[10px] font-bold text-zinc-450 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">
                          标题 (Title)
                        </label>
                        <input
                          type="text"
                          required
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="例如：第一节的内容"
                          className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
                        />
                      </div>

                      {/* Hierarchy Configuration (Extremely clear Page Slug + Folder Category) */}
                      <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl space-y-3 shrink-0">
                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                          <FolderPlus className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-350" />
                          所属折叠目录与页面路径
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                              所属折叠文件夹目录（选填）
                            </label>
                            <input
                              type="text"
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              list="existing-directories"
                              placeholder="选择或输入新目录，例如：快速入门"
                              className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-medium"
                            />
                            {/* Autocomplete list for directories */}
                            <datalist id="existing-directories">
                              {existingCategories.map(cat => (
                                <option key={cat} value={cat} />
                              ))}
                            </datalist>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                              当前页面路径名称（必填）
                            </label>
                            <input
                              type="text"
                              required
                              value={editPageSlug}
                              onChange={(e) => setEditPageSlug(e.target.value)}
                              placeholder="例如：第一节"
                              className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-mono"
                            />
                          </div>
                        </div>

                        {/* Real-time routing path review */}
                        {editPageSlug.trim() && (
                          <div className="bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                              页面生成链接: <code className="bg-slate-100 dark:bg-zinc-950 px-1 py-0.5 rounded font-mono text-blue-600 dark:text-blue-400 font-bold">/docs/{finalSlug}</code>
                              <br />
                              物理存储路径: <code className="font-mono text-zinc-400">content/docs/{finalSlug}.mdx</code>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="shrink-0">
                        <label className="block text-[10px] font-bold text-zinc-450 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">
                          描述 (Description)
                        </label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="文档简短描述"
                          className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
                        />
                      </div>

                      {/* MDX Content Block */}
                      <div className="flex-1 flex flex-col min-h-[300px]">
                        <div className="flex justify-between items-center mb-1.5 shrink-0">
                          <label className="block text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                            正文内容 (Markdown)
                          </label>
                          {/* Tab selector for mobile view */}
                          <div className="flex md:hidden bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xxs">
                            <button
                              type="button"
                              onClick={() => setActiveTab('edit')}
                              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                                activeTab === 'edit' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-505'
                              }`}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab('preview')}
                              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                                activeTab === 'preview' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-505'
                              }`}
                            >
                              预览
                            </button>
                          </div>
                        </div>

                        {/* Main Editor Textarea */}
                        <div className="flex-1 relative">
                          <textarea
                            required
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            placeholder="# 在此输入文档内容..."
                            className={`w-full h-full p-4 rounded-lg bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-900 transition-all font-mono text-xs resize-none leading-relaxed min-h-full ${
                              activeTab === 'edit' ? 'block' : 'hidden md:block'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Preview */}
                    <div className={`flex-1 flex flex-col bg-slate-50 dark:bg-zinc-950 overflow-hidden ${
                      activeTab === 'preview' ? 'block' : 'hidden md:flex'
                    }`}>
                      {/* Preview Toolbar */}
                      <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm px-5 py-2.5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                            <Eye className="w-3 h-3" />
                            预览
                          </div>
                          {finalSlug && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full relative -top-[1px]">
                              /docs/{finalSlug}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {!isNew && (
                            <button
                              type="button"
                              onClick={handleDelete}
                              disabled={isLoading}
                              className="h-7 px-3.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 border border-rose-250 hover:bg-rose-50 text-rose-650 dark:border-rose-900/50 dark:hover:bg-rose-950/20 dark:text-rose-450 bg-white dark:bg-zinc-900"
                            >
                              <Trash2 className="w-3 h-3" />
                              删除文档
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="h-7 px-4 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 border border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-sm"
                          >
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            保存
                          </button>
                        </div>
                      </div>

                      {/* Preview Content */}
                      <div className="flex-1 flex overflow-hidden">
                        {/* Main preview pane */}
                        <div className="flex-1 overflow-y-auto" id="preview-scroll-container">
                          <div className="mdp-wrapper">
                            {/* Breadcrumb */}
                            {finalSlug && (
                              <nav className="mdp-breadcrumb">
                                <span>文档</span>
                                {editCategory && (
                                  <>
                                    <ChevronRight className="w-3 h-3" />
                                    <span>{editCategory}</span>
                                  </>
                                )}
                                <ChevronRight className="w-3 h-3" />
                                <span className="mdp-breadcrumb-current">{editPageSlug || editTitle}</span>
                              </nav>
                            )}

                            {/* Document header */}
                            <header className="mdp-doc-header">
                              <h1 className="mdp-doc-title">
                                {editTitle || '无标题文档'}
                              </h1>
                              {editDescription && (
                                <p className="mdp-doc-desc">{editDescription}</p>
                              )}
                              {!editDescription && (
                                <p className="mdp-doc-desc mdp-doc-desc-empty">暂无描述</p>
                              )}
                            </header>

                            {/* Rendered markdown body */}
                            <article 
                              className="mdp-body"
                              dangerouslySetInnerHTML={{ __html: renderedPreview.html }} 
                            />
                          </div>
                        </div>

                        {/* Table of Contents sidebar */}
                        {renderedPreview.toc.length > 0 && (
                          <aside className="hidden lg:flex flex-col w-52 shrink-0 bg-white/40 dark:bg-zinc-900/20 overflow-y-auto">
                            <div className="sticky top-0 p-4">
                              <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <List className="w-3 h-3" />
                                目录 ({renderedPreview.toc.length})
                              </div>
                              <nav className="space-y-0.5">
                                {renderedPreview.toc.map((item, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => scrollToHeading(item.id)}
                                    className={`block w-full text-left text-[11px] leading-snug py-1 px-2 rounded transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 ${
                                      item.level === 1 ? 'font-semibold' : item.level === 2 ? 'pl-4' : 'pl-7 text-[10px]'
                                    }`}
                                    title={item.text}
                                  >
                                    <span className="block truncate">{item.text}</span>
                                  </button>
                                ))}
                              </nav>
                            </div>
                          </aside>
                        )}
                      </div>
                    </div>
                  </div>
                </form>
            ) : (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-400 mb-4 shadow-sm border border-slate-100 dark:border-zinc-850">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-bold mb-1">未选择文档</h3>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleNewDoc}
                    className="bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg px-4 py-1.5 font-bold text-xs transition-all shadow-sm"
                  >
                    新建文档
                  </button>
                  <button
                    onClick={fetchDocs}
                    className="bg-white hover:bg-slate-50 text-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-1.5 font-bold text-xs transition-all"
                  >
                    刷新列表
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
        </>
      )}
    </div>
  );
}
