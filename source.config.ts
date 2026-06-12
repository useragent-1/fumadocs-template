import { defineDocs, defineConfig } from 'fumadocs-mdx/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

export const docs = defineDocs({
  dir: 'content/docs',
});

function remarkEnvAlias() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (node.type === 'code' && node.lang === 'env') {
        node.lang = 'properties';
      }
      if (node.children) {
        node.children.forEach(walk);
      }
    };
    walk(tree);
  };
}

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMath, remarkEnvAlias],
    rehypePlugins: (v) => [rehypeKatex, ...v],
  },
});
