# Payload CMS — Configuration

<!-- Source: https://github.com/payloadcms/payload (Context7: /payloadcms/payload) -->

## Full buildConfig Options

```typescript
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { mongooseAdapter } from '@payloadcms/db-mongodb'

export default buildConfig({
  // Required
  secret: process.env.PAYLOAD_SECRET!,

  // Database
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
  }),

  // Collections (primary data models)
  collections: [...],

  // Globals (single-instance documents)
  globals: [...],

  // Admin panel settings
  admin: {
    user: 'users',           // Collection slug for auth
    meta: {
      titleSuffix: '- My CMS',
    },
    importMap: {
      baseDir: path.resolve(dirname, 'src'),
    },
  },

  // CORS origins
  cors: [
    'http://localhost:3000',
    'https://mysite.com',
  ],

  // Server URL
  serverURL: process.env.SERVER_URL || 'http://localhost:3000',
})
```

## Collection Configuration

```typescript
import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: {
    singular: 'Post',
    plural: 'Posts',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'updatedAt'],
  },
  access: {
    read: () => true,                          // Public reads
    create: ({ req }) => !!req.user,           // Auth required
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
    },
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'published'],
      defaultValue: 'draft',
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (data.status === 'published' && !data.publishedAt) {
          data.publishedAt = new Date()
        }
        return data
      },
    ],
  },
}
```

## Field Types

| Type | Description |
|------|-------------|
| `text` | Single-line text |
| `textarea` | Multi-line text |
| `number` | Numeric value |
| `email` | Email address |
| `date` | Date/time |
| `checkbox` | Boolean |
| `select` | Dropdown (single) |
| `radio` | Radio group |
| `relationship` | Reference to another collection |
| `upload` | File/media upload |
| `richText` | Rich text editor |
| `array` | Repeating group of fields |
| `blocks` | Flexible content blocks |
| `group` | Grouped fields (no array) |
| `tabs` | Tabbed field layout |
| `json` | Raw JSON |
| `code` | Code editor |
| `point` | Lat/long coordinates |

## Globals Configuration

```typescript
import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  fields: [
    { name: 'siteName', type: 'text' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'footerText', type: 'textarea' },
  ],
}
```

## Upload Collection

```typescript
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'media',
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, crop: 'centre' },
      { name: 'card', width: 768, height: 1024, crop: 'centre' },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*'],
  },
  fields: [
    { name: 'alt', type: 'text' },
  ],
}
```

## PostgreSQL Database Migrations

```bash
# Create a migration
pnpm payload migrate:create

# Run migrations
pnpm payload migrate

# CI: run migrations then build
pnpm payload migrate && pnpm build
```

## plugins

```typescript
import { seoPlugin } from '@payloadcms/plugin-seo'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'

export default buildConfig({
  plugins: [
    seoPlugin({ collections: ['posts'] }),
    redirectsPlugin({ collections: ['posts', 'pages'] }),
    nestedDocsPlugin({ collections: ['pages'] }),
  ],
})
```
