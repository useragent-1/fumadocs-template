'use client';

import React, { useState, useEffect } from 'react';
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
  Upload
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

  const getCombinedSlug = () => {
    const cleanCat = editCategory.trim().replace(/^\/|\/$/g, '');
    const cleanPage = editPageSlug.trim().replace(/^\/|\/$/g, '');
    
    if (!cleanPage) return '';
    return cleanCat ? `${cleanCat}/${cleanPage}` : cleanPage;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSlug = getCombinedSlug();
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
  const getExistingCategories = () => {
    const categories = docs.map(doc => {
      const { category } = parseSlug(doc.slug);
      return category;
    }).filter(cat => cat !== '');
    return Array.from(new Set(categories));
  };

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

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const zipEntries: { path: string; contentPromise: Promise<string> }[] = [];
          
          zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && (relativePath.endsWith('.md') || relativePath.endsWith('.mdx'))) {
              zipEntries.push({
                path: relativePath,
                contentPromise: zipEntry.async('string')
              });
            }
          });

          for (const entry of zipEntries) {
            try {
              const fileContent = await entry.contentPromise;
              const { title, description, body } = parseFrontmatterClient(fileContent, entry.path);
              const slug = entry.path.replace(/\.mdx?$/, '');
              await importDocToServer(slug, title, description, body);
              importedCount++;
            } catch (err) {
              console.error(`Failed to import ${entry.path} from ZIP:`, err);
              errorCount++;
            }
          }
        } else if (file.name.endsWith('.md') || file.name.endsWith('.mdx')) {
          try {
            const fileContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsText(file);
            });
            const { title, description, body } = parseFrontmatterClient(fileContent, file.name);
            const slug = file.name.replace(/\.mdx?$/, '');
            await importDocToServer(slug, title, description, body);
            importedCount++;
          } catch (err) {
            console.error(`Failed to import file ${file.name}:`, err);
            errorCount++;
          }
        }
      }

      if (importedCount > 0) {
        showStatus('success', `成功导入 ${importedCount} 个文档${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`);
        await fetchDocs();
      } else {
        showStatus('error', '未找到可导入的 Markdown 文档');
      }
    } catch (err: any) {
      showStatus('error', `导入失败: ${err.message}`);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const filteredDocs = docs.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderMarkdown = (md: string) => {
    if (!md) return '<p class="text-zinc-400 italic">空内容</p>';
    
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fenced code blocks
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      const lines = code.trim().split('\n');
      const lang = lines[0];
      const codeContent = lines.slice(1).join('\n');
      return `<pre class="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-lg my-4 overflow-x-auto font-mono text-sm border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"><div class="text-xs text-zinc-400 mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-1">${lang || 'code'}</div><code>${codeContent}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded font-mono text-sm text-pink-600 dark:text-pink-400 border border-zinc-200 dark:border-zinc-850">$1</code>');

    // Headers
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-extrabold my-5 border-b pb-2 dark:border-zinc-800 text-zinc-900 dark:text-white">$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold my-4 border-b pb-1 dark:border-zinc-800 text-zinc-900 dark:text-white">$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold my-3 text-zinc-900 dark:text-white">$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-lg font-medium my-2 text-zinc-900 dark:text-white">$1</h4>');

    // Bold & Italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-4 py-1 my-4 italic text-zinc-650 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/30">$1</blockquote>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">$1 ↗</a>');

    // List items
    html = html.replace(/^\- (.*$)/gim, '<li class="list-disc ml-6 my-1.5 text-zinc-750 dark:text-zinc-300">$1</li>');
    html = html.replace(/^\* (.*$)/gim, '<li class="list-disc ml-6 my-1.5 text-zinc-750 dark:text-zinc-300">$1</li>');
    html = html.replace(/^\d+\. (.*$)/gim, '<li class="list-decimal ml-6 my-1.5 text-zinc-750 dark:text-zinc-300">$1</li>');

    const lines = html.split('\n');
    html = lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '<br />';
        if (
          trimmed.startsWith('<h') ||
          trimmed.startsWith('<pre') ||
          trimmed.startsWith('<blockquote') ||
          trimmed.startsWith('<li') ||
          trimmed.startsWith('<br')
        ) {
          return line;
        }
        return `<p class="my-3 leading-relaxed text-zinc-700 dark:text-zinc-350">${line}</p>`;
      })
      .join('\n');

    return html;
  };

  const finalSlug = getCombinedSlug();
  const existingCategories = getExistingCategories();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      
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
          <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-slate-200 dark:border-zinc-800 px-6 py-4.5 flex items-center justify-between">
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
            <aside className="w-80 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
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
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
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
              <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 flex flex-col gap-2 shrink-0">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  数据管理 (Markdown)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExportZip}
                    disabled={isLoading || docs.length === 0}
                    className="py-1.5 px-3 rounded-lg text-xxs font-semibold border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    一键导出
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById('import-file-input')?.click()}
                    disabled={isLoading}
                    className="py-1.5 px-3 rounded-lg text-xxs font-semibold border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer"
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
                  <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-6 py-3.5 flex items-center justify-between shrink-0">
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

                    <div className="flex items-center gap-2">
                      {!isNew && (
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={isLoading}
                          className="h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 border border-rose-200 hover:bg-rose-50 text-rose-650 dark:border-rose-900/50 dark:hover:bg-rose-950/20 dark:text-rose-450"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除文档
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="h-8 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 border border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-sm"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        保存
                      </button>
                    </div>
                  </div>

                  {/* Form fields & Editor */}
                  <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Left Column */}
                    <div className="flex-1 flex flex-col overflow-y-auto border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
                      
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
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
                        />
                      </div>

                      {/* Hierarchy Configuration (Extremely clear Page Slug + Folder Category) */}
                      <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-850 space-y-3 shrink-0">
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
                              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-medium"
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
                              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-mono"
                            />
                          </div>
                        </div>

                        {/* Real-time routing path review */}
                        {editPageSlug.trim() && (
                          <div className="bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg border border-slate-150 dark:border-zinc-800 flex items-start gap-2">
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
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
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
                            className={`w-full h-full p-4 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-900 transition-all font-mono text-xs resize-none leading-relaxed min-h-full ${
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
                      <div className="bg-slate-100/50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800 px-6 py-2 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                          <Eye className="w-3 h-3" />
                          预览
                        </div>
                      </div>

                      {/* Preview Pane */}
                      <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-zinc-900 md:bg-transparent md:dark:bg-transparent">
                        <div className="max-w-2xl mx-auto prose prose-slate dark:prose-invert">
                          {/* Title and Description preview */}
                          <div className="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                            <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-2">
                              {editTitle || '（无标题）'}
                            </h1>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                              {editDescription || '（无描述）'}
                            </p>
                          </div>

                          {/* MDX Body preview */}
                          <div 
                            className="markdown-preview text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(editContent) }} 
                        />
                      </div>
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
