import createMDX from '@next/mdx'

const withMDX = createMDX({
  // remark/rehype plugins can go here
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  // A stray package-lock.json in the parent VSCode folder (belongs to an
  // unrelated ops-synthesis.js script) makes Next.js misdetect the
  // workspace root. Pin it explicitly instead of touching that file.
  outputFileTracingRoot: import.meta.dirname,
}

export default withMDX(nextConfig)
