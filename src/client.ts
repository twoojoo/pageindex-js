import FormData from "form-data";
import axios from "axios";
import fs from "node:fs"

export class PageIndexAPIError extends Error { }

/* ---------- Shared Types ---------- */

export interface Message {
    role: string;
    content: string;
}

export interface StreamChunk {
    choices?: Array<{
        delta?: { content?: string };
    }>;
    [key: string]: any;
}

export interface SubmitDocumentResponse {
    doc_id: string;
    [key: string]: any;
}

export interface OCRResponse {
    status: string;
    [key: string]: any;
}

export interface TreeResponse {
    retrieval_ready?: boolean;
    [key: string]: any;
}

export interface RetrievalSubmitResponse {
    retrieval_id: string;
    [key: string]: any;
}

export interface RetrievalResponse {
    status: string;
    [key: string]: any;
}

export interface ChatCompletionResponse {
    [key: string]: any;
}

export interface DocumentMetadata {
    id: string;
    name: string;
    description: string;
    status: string;
    createdAt: string;
    pageNum: number;
    [key: string]: any;
}

export interface ListDocumentsResponse {
    documents: DocumentMetadata[];
    total: number;
    limit: number;
    offset: number;
    [key: string]: any;
}

/* ---------- Client ---------- */

export class PageIndexClient {
    private apiKey: string;
    private static BASE_URL = "https://api.pageindex.ai";

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private headers(extra?: Record<string, string>): Record<string, string> {
        return {
            api_key: this.apiKey,
            ...(extra ?? {}),
        };
    }

    /* ---------- DOCUMENT SUBMISSION ---------- */

    async submitDocument(filePath: string): Promise<SubmitDocumentResponse> {
        const formData = new FormData();
        const filename = filePath.split("/").pop() || "document.pdf";

        const fileStream = fs.createReadStream(filePath);
        formData.append("file", fileStream, { filename });
        formData.append("if_retrieval", "True");

        try {
            const response = await axios.post(`${PageIndexClient.BASE_URL}/doc/`, formData, {
                headers: {
                    ...this.headers(),
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
            });

            return response.data;
        } catch (err: any) {
            const message = err.response?.data || err.message;
            throw new PageIndexAPIError(`Failed to submit document: ${JSON.stringify(message)}`);
        }
    }

    async submitDocumentBuffer(filename: string, file: Buffer): Promise<SubmitDocumentResponse> {
        if (!filename.endsWith(".pdf")) throw new PageIndexAPIError("Only PDF files are supported.")

        const formData = new FormData();

        formData.append("file", file, { filename });
        formData.append("if_retrieval", "True");

        try {
            const response = await axios.post(`${PageIndexClient.BASE_URL}/doc/`, formData, {
                headers: {
                    ...this.headers(),
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
            });

            return response.data;
        } catch (err: any) {
            const message = err.response?.data || err.message;
            throw new PageIndexAPIError(`Failed to submit document: ${JSON.stringify(message)}`);
        }
    }

    /* ---------- OCR ---------- */

    async getOCR(docId: string, format: "page" | "node" = "page"): Promise<OCRResponse> {
        const res = await fetch(
            `${PageIndexClient.BASE_URL}/doc/${docId}/?type=ocr&format=${format}`,
            { headers: this.headers() }
        );

        if (!res.ok) {
            throw new PageIndexAPIError(`Failed to get OCR result: ${await res.text()}`);
        }
        return res.json();
    }

    /* ---------- TREE ---------- */

    async getTree(docId: string, nodeSummary = false): Promise<TreeResponse> {
        const res = await fetch(
            `${PageIndexClient.BASE_URL}/doc/${docId}/?type=tree&summary=${nodeSummary}`,
            { headers: this.headers() }
        );

        if (!res.ok) {
            throw new PageIndexAPIError(`Failed to get tree result: ${await res.text()}`);
        }
        return res.json();
    }

    async isRetrievalReady(docId: string): Promise<boolean> {
        try {
            const result = await this.getTree(docId);
            return result.retrieval_ready ?? false;
        } catch {
            return false;
        }
    }

    /* ---------- RETRIEVAL ---------- */

    async submitQuery(
        docId: string,
        query: string,
        thinking = false
    ): Promise<RetrievalSubmitResponse> {
        const payload = { doc_id: docId, query, thinking };

        const res = await fetch(`${PageIndexClient.BASE_URL}/retrieval/`, {
            method: "POST",
            headers: this.headers({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new PageIndexAPIError(`Failed to submit retrieval: ${await res.text()}`);
        }
        return res.json();
    }

    async getRetrieval(retrievalId: string): Promise<RetrievalResponse> {
        const res = await fetch(
            `${PageIndexClient.BASE_URL}/retrieval/${retrievalId}/`,
            { headers: this.headers() }
        );

        if (!res.ok) {
            throw new PageIndexAPIError(`Failed to get retrieval result: ${await res.text()}`);
        }
        return res.json();
    }

    /* ---------- CHAT COMPLETIONS ---------- */

    async chatCompletions<S extends boolean = false, M extends boolean = false>(params: {
        messages: Message[];
        stream?: S;
        doc_id?: string | string[] | null;
        temperature?: number | null;
        stream_metadata?: M;
    }): Promise<S extends true
        ? M extends true
        ? AsyncGenerator<StreamChunk>
        : AsyncGenerator<string>
        : ChatCompletionResponse
    > {
        const { messages, stream = false, temperature = null, stream_metadata } = params;
        let { doc_id = null } = params

        // TODO no limit
        if (!doc_id) {
            doc_id = (await this.listDocuments()).documents.map(d => d.id) || []
        }

        const payload: Record<string, any> = { messages, stream, doc_id };
        if (temperature != null) payload.temperature = temperature;

        const res = await fetch(`${PageIndexClient.BASE_URL}/chat/completions/`, {
            method: "POST",
            headers: this.headers({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new PageIndexAPIError(`Failed to get chat completion: ${await res.text()}`);
        }

        if (!stream) {
            return res.json();
        }

        const reader = res.body!.getReader();

        return stream_metadata
            ? this.streamRaw(reader) as any
            : this.streamText(reader) as any
    }

    private async *streamText(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<string> {
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);

            for (const line of text.split("\n")) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") return;

                    try {
                        const chunk: StreamChunk = JSON.parse(data);
                        const content =
                            chunk.choices?.[0]?.delta?.content ?? "";
                        if (content) yield content;
                    } catch {
                        continue;
                    }
                }
            }
        }
    }

    private async *streamRaw(
        reader: ReadableStreamDefaultReader<Uint8Array>
    ): AsyncGenerator<StreamChunk> {
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);

            for (const line of text.split("\n")) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") return;

                    try {
                        yield JSON.parse(data) as StreamChunk;
                    } catch {
                        continue;
                    }
                }
            }
        }
    }

    /* ---------- DOCUMENT MGMT ---------- */

    async getDocument(docId: string): Promise<DocumentMetadata> {
        const res = await fetch(
            `${PageIndexClient.BASE_URL}/doc/${docId}/metadata/`,
            { headers: this.headers() }
        );

        if (!res.ok) {
            throw new PageIndexAPIError(`Failed to get document metadata: ${await res.text()}`);
        }
        return res.json();
    }

    async deleteDocument(docId: string): Promise<Record<string, any>> {
        const res = await fetch(
            `${PageIndexClient.BASE_URL}/doc/${docId}/`,
            { method: "DELETE", headers: this.headers() }
        );

        if (!res.ok) {
            throw new PageIndexAPIError(`Failed to delete document: ${await res.text()}`);
        }
        return res.json();
    }

    async listDocuments(
        limit = 50,
        offset = 0
    ): Promise<ListDocumentsResponse> {
        if (limit < 1 || limit > 100) {
            throw new Error("limit must be between 1 and 100");
        }
        if (offset < 0) {
            throw new Error("offset must be non-negative");
        }

        const url = new URL(`${PageIndexClient.BASE_URL}/docs/`);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offset", String(offset));

        const res = await fetch(url, { headers: this.headers() });

        if (!res.ok) {
            throw new PageIndexAPIError(`Failed to list documents: ${await res.text()}`);
        }
        return res.json();
    }
}
