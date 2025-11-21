// utils.ts — remove_fields, print_wrapped, print_tree, create_node_mapping
import { TreeNode, NodeMapping, PageRangeInfo } from "./types";
import util from "node:util";

export function removeFields(
    data: unknown,
    fields: string[] = ["text"],
    maxLen?: number
): unknown {
    if (Array.isArray(data)) {
        return data.map((item) => removeFields(item, fields, maxLen));
    }

    if (typeof data === "object" && data !== null) {
        const obj = data as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
            if (!fields.includes(k)) {
                out[k] = removeFields(v, fields, maxLen);
            }
        }
        return out;
    }

    if (typeof data === "string") {
        if (maxLen !== undefined && data.length > maxLen) {
            return data.slice(0, maxLen) + "...";
        }
        return data;
    }

    return data;
}

export function printTree(
    tree: TreeNode,
    excludeFields: string[] = ["text", "page_index"]
): void {
    const cleaned = removeFields(structuredClone(tree), excludeFields, 40);
    console.log(util.inspect(cleaned, { depth: null, colors: false, sorted: false }));
}

export function printWrapped(text: string, width = 100): void {
    for (const line of text.split("\n")) {
        const wrapped = line.match(new RegExp(`.{1,${width}}`, "g")) ?? [];
        for (const w of wrapped) console.log(w);
    }
}

export function createNodeMapping(
    tree: TreeNode | TreeNode[],
    includePageRanges = false,
    maxPage?: number
): NodeMapping {
    const allNodes: TreeNode[] = getAllNodes(tree);

    if (!includePageRanges) {
        const map: Record<string, TreeNode> = {};
        for (const node of allNodes) {
            if (node.node_id) map[node.node_id] = node;
        }
        return map;
    }

    const map: Record<string, PageRangeInfo> = {};
    for (let i = 0; i < allNodes.length; i++) {
        const node = allNodes[i];
        if (!node.node_id) continue;

        const start = node.page_index;
        let end: number | undefined;

        if (i + 1 < allNodes.length) {
            end = allNodes[i + 1].page_index;
        } else {
            end = maxPage;
        }

        map[node.node_id] = { node, start_index: start, end_index: end };
    }

    return map;
}

function getAllNodes(tree: TreeNode | TreeNode[]): TreeNode[] {
    if (Array.isArray(tree)) {
        return tree.flatMap(getAllNodes);
    }

    const nodes = tree.nodes ?? [];
    return [tree, ...nodes.flatMap(getAllNodes)];
}
