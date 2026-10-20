import type { MDXComponents } from 'mdx/types';
import { ContentLink, ContentTable, SectionHeading } from './blocks';

/** How plain Markdown elements render inside chapters. */
export const mdxComponents: MDXComponents = {
  h2: SectionHeading,
  a: ContentLink,
  table: ContentTable,
};
