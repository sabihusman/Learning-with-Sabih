import { SITE_URL } from './site'
import { SECTION_ORDER, TOPICS } from './topicList'
import { sectionSlug } from './sectionColors'

export const dynamic = 'force-static'

export default function sitemap() {
  return [
    { url: `${SITE_URL}/` },
    ...SECTION_ORDER.map((name) => ({ url: `${SITE_URL}/chapters/${sectionSlug(name)}/` })),
    ...TOPICS.map((topic) => ({ url: `${SITE_URL}${topic.href}` })),
  ]
}
