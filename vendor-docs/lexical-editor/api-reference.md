# Lexical Editor — Plugin & API Reference

<!-- Source: https://lexical.dev/docs (Context7: /websites/lexical_dev) -->

## Available Plugins

### Core Plugins

```tsx
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin'
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin'

// Usage
<LexicalComposer initialConfig={initialConfig}>
  <RichTextPlugin
    contentEditable={<ContentEditable aria-placeholder="..." placeholder={<div>...</div>} />}
    ErrorBoundary={LexicalErrorBoundary}
  />
  <HistoryPlugin />        {/* Undo/redo */}
  <AutoFocusPlugin />      {/* Focus on mount */}
  <TabIndentationPlugin /> {/* Tab key indentation */}
  <ClearEditorPlugin />    {/* Adds CLEAR_EDITOR_COMMAND */}
</LexicalComposer>
```

### List Plugin

```bash
npm install @lexical/list @lexical/react
```

```tsx
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { ListNode, ListItemNode } from '@lexical/list'

const initialConfig = {
  namespace: 'MyEditor',
  nodes: [ListNode, ListItemNode],
  onError,
}

<LexicalComposer initialConfig={initialConfig}>
  <RichTextPlugin ... />
  <ListPlugin />       {/* ordered/unordered lists */}
  <CheckListPlugin />  {/* checkbox lists (requires CSS) */}
</LexicalComposer>
```

### Link Plugin

```tsx
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { LinkNode, AutoLinkNode } from '@lexical/link'

<LinkPlugin />
```

### Markdown Shortcuts

```tsx
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { TRANSFORMERS } from '@lexical/markdown'

<MarkdownShortcutPlugin transformers={TRANSFORMERS} />
```

### Table Plugin

```tsx
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table'

<TablePlugin />
```

## Custom Plugin Pattern

```tsx
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND } from 'lexical'

function MyCustomPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    // Register a command listener
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        if (event.shiftKey) {
          // Handle Shift+Enter
          return true // Return true to prevent default
        }
        return false // Propagate to next handler
      },
      COMMAND_PRIORITY_NORMAL
    )
  }, [editor])

  return null
}
```

## Reading/Writing Editor State

```typescript
import { $getRoot, $getSelection, $createParagraphNode, $createTextNode } from 'lexical'

// Read editor state (safe in any context)
editor.getEditorState().read(() => {
  const root = $getRoot()
  const text = root.getTextContent()
  console.log(text)
})

// Update editor state
editor.update(() => {
  const root = $getRoot()
  const paragraph = $createParagraphNode()
  const text = $createTextNode('Hello, Lexical!')
  paragraph.append(text)
  root.clear()
  root.append(paragraph)
})

// Register update listener
const unregister = editor.registerUpdateListener(({ editorState }) => {
  editorState.read(() => {
    const root = $getRoot()
    console.log('Text:', root.getTextContent())
  })
})

// Clean up
unregister()
```

## Node Types

```typescript
import {
  $createParagraphNode,     // Paragraph
  $createTextNode,          // Text
  $createLineBreakNode,     // Line break
  $isParagraphNode,         // Type guard
  $isTextNode,              // Type guard
  ParagraphNode,
  TextNode,
  ElementNode,
  RootNode,
} from 'lexical'

import { $createHeadingNode, HeadingNode } from '@lexical/rich-text'
import { $createListNode, $createListItemNode, ListNode, ListItemNode } from '@lexical/list'
import { $createLinkNode, LinkNode } from '@lexical/link'
import { $createCodeNode, CodeNode, CodeHighlightNode } from '@lexical/code'
```

## Serialization

```typescript
// Export to JSON
const json = editor.getEditorState().toJSON()
const jsonString = JSON.stringify(json)

// Export to HTML
import { $generateHtmlFromNodes } from '@lexical/html'

editor.getEditorState().read(() => {
  const htmlString = $generateHtmlFromNodes(editor)
  console.log(htmlString)
})

// Import from HTML
import { $generateNodesFromDOM } from '@lexical/html'
import { $insertNodes } from 'lexical'

editor.update(() => {
  const parser = new DOMParser()
  const dom = parser.parseFromString(htmlString, 'text/html')
  const nodes = $generateNodesFromDOM(editor, dom)
  $insertNodes(nodes)
})
```

## Text Formatting Commands

```typescript
import {
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CLEAR_EDITOR_COMMAND,
} from 'lexical'

// Bold
editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')

// Italic
editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')

// Underline
editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')

// Strikethrough
editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')

// Heading alignment
editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')

// Undo/Redo
editor.dispatchCommand(UNDO_COMMAND, undefined)
editor.dispatchCommand(REDO_COMMAND, undefined)
```

## Integration with Payload CMS

Payload uses Lexical as its default rich text editor:

```typescript
// payload.config.ts
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export default buildConfig({
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      // Add custom features
    ],
  }),
})
```
