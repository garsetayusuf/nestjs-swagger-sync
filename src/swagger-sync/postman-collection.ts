export interface PostmanHeader {
  key: string;
  value: string;
}

export interface PostmanUrl {
  raw: string;
  host: string[];
  path: string[];
}

export interface PostmanRequest {
  method: string;
  header: PostmanHeader[];
  url: PostmanUrl;
}

export interface PostmanFolder {
  name: string;
  item: CollectionNode[];
}

export interface PostmanEndpoint {
  name: string;
  request: PostmanRequest;
  response: unknown[];
}

export type CollectionNode = PostmanFolder | PostmanEndpoint;

export interface PostmanCollection {
  info: {
    name: string;
    description: string;
    schema: string;
  };
  variable: Array<{
    key: string;
    value: string;
    type: string;
  }>;
  item: CollectionNode[];
}

export function isPostmanFolder(node: CollectionNode): node is PostmanFolder {
  return 'item' in node && Array.isArray(node.item);
}
