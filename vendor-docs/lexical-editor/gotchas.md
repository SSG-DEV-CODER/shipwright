# Lexical Editor — Gotchas & Common Mistakes

<!-- Source: https://lexical.dev/docs (Context7: /websites/lexical_dev) -->

## 1. All Editor State Updates Must Be Inside `editor.update()`

```typescript
// ❌ Modifying nodes outside update() causes errors
const root = $getRoot()
root.append($createParagraphNode())  // Throws!

// ✅ Always use editor.update()
editor.update(() => {
  const root = $getRoot()
  root.append($createParagraphNode())
})
```

## 2. `$` Prefix Functions Only Work Inside Editor Update/Read Context

```typescript
// ❌ Calling $-prefixed functions outside of context
const root = $getRoot()  // Throws — not in editor context!

// ✅ Inside read()
editor.getEditorState().read(() => {
  const root = $getRoot()  // Works
})

// ✅ Inside update()
editor.update(() => {
  const root = $getRoot()  // Works
})
```

## 3. Custom Nodes Must Be Registered in `initialConfig`

```typescript
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'

// ❌ Using HeadingNode without registering it
const config = {
  namespace: 'Editor',
  onError,
  // Nodes not listed — will error when creating heading nodes!
}

// ✅ Register all custom nodes
const config = {
  namespace: 'Editor',
  onError,
  nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode],
}
```

## 4. `useLexicalComposerContext` Must Be Inside `LexicalComposer`

```typescript
// ❌ Using hook outside of LexicalComposer
function App() {
  const [editor] = useLexicalComposerContext()  // Throws!
  return <LexicalComposer ...>...</LexicalComposer>
}

// ✅ Use the hook inside a plugin that's rendered within LexicalComposer
function MyPlugin() {
  const [editor] = useLexicalComposerContext()  // Works
  return null
}

function App() {
  return (
    <LexicalComposer initialConfig={config}>
      <MyPlugin />  {/* ✅ Inside LexicalComposer */}
    </LexicalComposer>
  )
}
```

## 5. Editor State JSON Includes Node Types — Don't Change Node Class Names

The serialized JSON references node types:

```json
{
  "root": {
    "children": [
      { "type": "heading", "tag": "h1", "children": [...] }
    ]
  }
}
```

If you rename custom node types, existing saved content will fail to load.

## 6. `editor.update()` is Async (Batched)

```typescript
// Updates are batched and applied asynchronously
editor.update(() => {
  // Changes queued here
})
// Changes may NOT be applied yet here

// ✅ To run code after update is applied:
editor.update(() => {
  // Make changes
}, {
  onUpdate: () => {
    // Runs after changes are committed
  }
})
```

## 7. Memory Leaks from Unregistered Listeners

```typescript
// ❌ Listener never removed → memory leak
editor.registerUpdateListener(({ editorState }) => {
  // ...
})

// ✅ Always unregister (returns cleanup function)
const unregister = editor.registerUpdateListener(({ editorState }) => {
  // ...
})

// In useEffect:
useEffect(() => {
  const unregister = editor.registerUpdateListener(...)
  return unregister  // Called on unmount
}, [editor])
```

## 8. CheckListPlugin Requires Custom CSS

The `CheckListPlugin` needs CSS to render checkboxes:

```css
/* Required for check list items */
.PlaygroundEditorTheme__listItemChecked,
.PlaygroundEditorTheme__listItemUnchecked {
  position: relative;
  margin-left: 8px;
  margin-right: 8px;
  padding-left: 24px;
  list-style-type: none;
}

.PlaygroundEditorTheme__listItemChecked:before,
.PlaygroundEditorTheme__listItemUnchecked:before {
  content: '';
  width: 16px;
  height: 16px;
  top: 2px;
  left: 0;
  position: absolute;
  cursor: pointer;
}
```

## 9. HTML Import/Export Requires `@lexical/html`

```typescript
// ❌ No built-in HTML serialization in core
const html = editor.getEditorState().toHTML()  // Doesn't exist!

// ✅ Use @lexical/html
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'

// Export
let html: string
editor.getEditorState().read(() => {
  html = $generateHtmlFromNodes(editor)
})

// Import
editor.update(() => {
  const parser = new DOMParser()
  const dom = parser.parseFromString(htmlString, 'text/html')
  const nodes = $generateNodesFromDOM(editor, dom)
  $insertNodes(nodes)
})
```

## 10. Integration with Payload CMS

When using Lexical through Payload CMS, don't instantiate it directly. Use Payload's `lexicalEditor()` wrapper:

```typescript
// payload.config.ts
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export default buildConfig({
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      // Add/remove features here
    ],
  }),
})
```

The serialized format from Payload's Lexical is different from standalone Lexical JSON — don't mix them.
