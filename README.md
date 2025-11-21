# PageIndex TypeScript SDK

A fully typed TypeScript client for the PageIndex API. This SDK allows you to interact with PageIndex for document submission, OCR, tree generation, retrieval, and chat completions in a type-safe manner.

---

## Table of Contents

- [PageIndex TypeScript SDK](#pageindex-typescript-sdk)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Initialization](#initialization)
  - [Document Submission](#document-submission)
  - [OCR](#ocr)
  - [Tree Generation](#tree-generation)
  - [Retrieval](#retrieval)
  - [Chat Completions](#chat-completions)
  - [Document Management](#document-management)
  - [Error Handling](#error-handling)

---

## Installation

```bash
npm install pageindex-js
# or
yarn add pageindex-js
````

Include the SDK in your project:

```ts
import { PageIndexClient } from 'pageindex-js';
```

---

## Initialization

```ts
import { PageIndexClient } from './pageindex-js';

const client = new PageIndexClient('YOUR_API_KEY');
```

---

## Document Submission

Upload a PDF document for processing:

```ts
const result = await client.submitDocument('./example.pdf');
console.log(result.doc_id);
```

---

## OCR

Get OCR processing results:

```ts
const ocrResult = await client.getOcr('doc_id_here', 'page'); // 'page' or 'node'
console.log(ocrResult);
```

---

## Tree Generation

Retrieve the document tree structure:

```ts
const tree = await client.getTree('doc_id_here', true); // true to include node summaries
console.log(tree);
```

Check if the document is ready for retrieval:

```ts
const ready = await client.isRetrievalReady('doc_id_here');
console.log(ready); // true or false
```

---

## Retrieval

Submit a query against a document:

```ts
const retrieval = await client.submitQuery('doc_id_here', 'What is the main topic?', true);
console.log(retrieval.retrieval_id);
```

Get retrieval results:

```ts
const retrievalResult = await client.getRetrieval('retrieval_id_here');
console.log(retrievalResult);
```

---

## Chat Completions

Generate a chat completion, optionally scoped to one or more documents:

```ts
const messages = [
  { role: 'user', content: 'Summarize the document.' }
];

const completion = await client.chatCompletions({messages: [], stream: false, doc_id: 'doc_id_here'});
console.log(completion);
```

Streaming responses:

```ts
for await (const chunk of client.chatCompletions({messages: [], stream: true, doc_id: 'doc_id_here'})) {
  console.log(chunk);
}
```

---

## Document Management

Get metadata for a document:

```ts
const doc = await client.getDocument('doc_id_here');
console.log(doc);
```

Delete a document:

```ts
await client.deleteDocument('doc_id_here');
```

List all documents with pagination:

```ts
const docs = await client.listDocuments(50, 0);
console.log(docs.documents);
```

---

## Error Handling

All API errors throw a `PageIndexAPIError`:

```ts
try {
  await client.getDocument('invalid_id');
} catch (err) {
  if (err instanceof PageIndexAPIError) {
    console.error('API error:', err.message);
  }
}
```

```