# Lexical Editor — Setup & Getting Started

<!-- Source: https://lexical.dev/docs (Context7: /websites/lexical_dev) -->

## Installation

```bash
npm install --save lexical @lexical/react
```

## Basic Rich Text Editor (React)

```tsx
// Editor.tsx
import { $getRoot, $getSelection } from 'lexical'
import { useEffect } from 'react'

import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'

const theme = {
  // Add theme classes here
  paragraph: 'editor-paragraph',
  text: {
    bold: 'editor-text-bold',
    italic: 'editor-text-italic',
    underline: 'editor-text-underline',
  },
}

function onError(error: Error) {
  console.error(error)
}

export function Editor() {
  const initialConfig = {
    namespace: 'MyEditor',
    theme,
    onError,
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            aria-placeholder="Enter some text..."
            placeholder={<div className="editor-placeholder">Enter some text...</div>}
          />
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <AutoFocusPlugin />
      <OnChangePlugin onChange={(editorState) => {
        editorState.read(() => {
          const root = $getRoot()
          console.log(root.getTextContent())
        })
      }} />
    </LexicalComposer>
  )
}
```

## Plain Text Editor

```tsx
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'

<LexicalComposer initialConfig={initialConfig}>
  <PlainTextPlugin
    contentEditable={<ContentEditable />}
    ErrorBoundary={LexicalErrorBoundary}
  />
  <HistoryPlugin />
</LexicalComposer>
```

## Additional Plugin Packages

```bash
# Lists
npm install @lexical/list

# Links
npm install @lexical/link

# Markdown shortcuts
npm install @lexical/markdown

# Code highlighting
npm install @lexical/code

# Table
npm install @lexical/table

# Rich text utilities
npm install @lexical/utils

# Collaboration (Yjs)
npm install @lexical/yjs yjs y-websocket
```

## Initial Config Options

```typescript
const initialConfig = {
  // Required
  namespace: 'MyEditor',

  // Error handler
  onError: (error: Error) => { throw error },

  // Custom nodes
  nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode],

  // Initial state
  editorState: null,               // Start empty
  // editorState: savedStateString,  // Load from JSON string
  // editorState: (editor) => { ... }, // Initialize programmatically

  // Theme
  theme: {},

  // Whether the editor is editable
  editable: true,
}
```

## Persist Editor State

```tsx
// Save
function MyOnChangePlugin({ onChange }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      onChange(editorState)
    })
  }, [editor, onChange])

  return null
}

// In your component:
const [editorState, setEditorState] = useState(null)

function handleChange(state) {
  const json = JSON.stringify(state.toJSON())
  setEditorState(json)
  // Save to database...
}
```

## Load Saved State

```typescript
const initialConfig = {
  namespace: 'MyEditor',
  onError,
  // Load from JSON string
  editorState: savedStateJSON,
}
```
