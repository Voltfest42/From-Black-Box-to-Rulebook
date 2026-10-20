import type { MDXComponents } from 'mdx/types';
import { ContentLink, SectionHeading } from './blocks';

/** How plain Markdown elements render inside chapters. */
export const mdxComponents: MDXComponents = {
  h2: SectionHeading,
  a: ContentLink,
};
