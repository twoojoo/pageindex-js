export interface TreeNode {
  node_id?: string;
  page_index?: number;
  text?: string;
  nodes?: TreeNode[];
  [key: string]: any;
}

export interface PageRangeInfo {
  node: TreeNode;
  start_index: number | undefined;
  end_index: number | undefined;
}

export type NodeMapping =
  | Record<string, TreeNode>
  | Record<string, PageRangeInfo>;

  